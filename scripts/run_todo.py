#!/usr/bin/env python3
"""
Hermes <-> Claude Code orkestrasyon scripti.
Kullanim:
  python3 scripts/run_todo.py add "Başlık" "Detaylı açıklama"        -> backlog'a ekler, id döner
  python3 scripts/run_todo.py list                                   -> backlog'u listeler
  python3 scripts/run_todo.py run <id>                                -> görevi çalıştırır (branch aç, claude -p çalıştır, push et)
  python3 scripts/run_todo.py show <id>                               -> görev detayını gösterir
"""
import json, sys, os, re, subprocess, datetime, uuid

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKLOG = os.path.join(REPO, ".agent", "backlog.json")
RESULTS_DIR = os.path.join(REPO, ".agent", "results")
os.makedirs(RESULTS_DIR, exist_ok=True)


def load():
    with open(BACKLOG) as f:
        return json.load(f)


def save(data):
    with open(BACKLOG, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def slugify(title):
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:40] or "task"


def cmd_add(title, description):
    data = load()
    tid = str(uuid.uuid4())[:8]
    slug = slugify(title)
    entry = {
        "id": tid,
        "slug": slug,
        "title": title,
        "description": description,
        "status": "pending",
        "branch": None,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "result_summary": None,
        "compare_url": None,
    }
    data.append(entry)
    save(data)
    print(json.dumps(entry, ensure_ascii=False, indent=2))


def cmd_list():
    print(json.dumps(load(), ensure_ascii=False, indent=2))


def cmd_show(tid):
    data = load()
    for e in data:
        if e["id"] == tid:
            print(json.dumps(e, ensure_ascii=False, indent=2))
            return
    print(f"NOT_FOUND: {tid}")
    sys.exit(1)


def sh(cmd, check=True, capture=False):
    print(f"$ {cmd}")
    r = subprocess.run(cmd, shell=True, cwd=REPO, capture_output=capture, text=True)
    if capture:
        print(r.stdout)
        print(r.stderr, file=sys.stderr)
    if check and r.returncode != 0:
        raise RuntimeError(f"Komut basarisiz ({r.returncode}): {cmd}")
    return r


def cmd_run(tid, max_turns="40"):
    data = load()
    entry = next((e for e in data if e["id"] == tid), None)
    if not entry:
        print(f"NOT_FOUND: {tid}")
        sys.exit(1)

    branch = f"feature/{entry['slug']}-{entry['id']}"
    entry["status"] = "in_progress"
    entry["branch"] = branch
    save(data)

    sh("git checkout main", check=False)
    sh("git pull origin main", check=False)
    sh(f"git checkout -B {branch}")

    prompt = f"""Görev: {entry['title']}

Açıklama: {entry['description']}

Talimatlar:
- Bu bir full-stack projedir (FastAPI backend + React frontend). /CLAUDE.md dosyasını oku, mimariyi anla.
- Backend değişikliği gerekiyorsa @backend-dev subagent'ını, frontend değişikliği gerekiyorsa @frontend-dev subagent'ını kullan. İkisi de gerekiyorsa ikisini de kullan.
- Kod değişikliklerini tamamladıktan SONRA mutlaka @qa-tester subagent'ını çağırıp değişiklikleri denetlet.
- Ardından mutlaka @security-reviewer subagent'ını çağırıp güvenlik açısından denetlet.
- QA veya security kritik bir sorun bulursa düzelt, tekrar kontrol ettir.
- Hiçbir zaman main branch'ine geçme, merge etme veya push etme. Sadece mevcut branch'te (`{branch}`) çalış.
- Değişiklikleri git commit ile kaydet (push YAPMA, ben yapacağım). Commit mesajı Türkçe ve açıklayıcı olsun.
- En sonunda kısa bir Türkçe özet ver: hangi dosyalar değişti, ne yapıldı, QA ve güvenlik sonucu ne oldu.
"""

    result = subprocess.run(
        [
            "claude", "-p", prompt,
            "--output-format", "json",
            "--max-turns", str(max_turns),
            "--allowedTools", "Read,Write,Edit,Bash,Glob,Grep",
            "--fallback-model", "haiku",
        ],
        cwd=REPO, capture_output=True, text=True, timeout=1800,
    )

    stdout = result.stdout.strip()
    summary_text = stdout
    cost = None
    try:
        parsed = json.loads(stdout)
        summary_text = parsed.get("result", stdout)
        cost = parsed.get("total_cost_usd")
    except Exception:
        pass

    diffstat = sh("git diff --stat main..HEAD", check=False, capture=True).stdout
    has_changes = sh("git status --porcelain", check=False, capture=True).stdout.strip() != "" or diffstat.strip() != ""

    if diffstat.strip() == "" and sh("git status --porcelain", check=False, capture=True).stdout.strip() == "":
        entry["status"] = "no_changes"
        save(data)
        print("UYARI: Hiç değişiklik yapılmadı.")
        return

    # commit any uncommitted leftovers
    sh("git add -A", check=False)
    sh(f'git commit -m "wip: {entry["title"]}" --allow-empty-message', check=False)

    sh(f"git push -u origin {branch}")

    compare_url = f"https://github.com/mesutayanoglu/config-management-tool/compare/main...{branch}?expand=1"
    entry["status"] = "review"
    entry["result_summary"] = summary_text
    entry["compare_url"] = compare_url
    entry["cost_usd"] = cost
    entry["diffstat"] = diffstat
    save(data)

    result_path = os.path.join(RESULTS_DIR, f"{entry['id']}.json")
    with open(result_path, "w") as f:
        json.dump(entry, f, ensure_ascii=False, indent=2)

    sh("git checkout main")

    print("=== GOREV TAMAMLANDI ===")
    print(json.dumps(entry, ensure_ascii=False, indent=2))


def cmd_approve(tid):
    """Onaylanan görevi main'e merge et."""
    data = load()
    entry = next((e for e in data if e["id"] == tid), None)
    if not entry or not entry.get("branch"):
        print(f"NOT_FOUND: {tid}")
        sys.exit(1)
    sh("git checkout main")
    sh("git pull origin main", check=False)
    sh(f"git merge --no-ff {entry['branch']} -m \"merge: {entry['title']} (onaylandi)\"")
    sh("git push origin main")
    entry["status"] = "merged"
    save(data)
    print(f"MERGED: {entry['branch']} -> main")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    action = sys.argv[1]
    if action == "add":
        cmd_add(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")
    elif action == "list":
        cmd_list()
    elif action == "show":
        cmd_show(sys.argv[2])
    elif action == "run":
        cmd_run(sys.argv[2])
    elif action == "approve":
        cmd_approve(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(1)
