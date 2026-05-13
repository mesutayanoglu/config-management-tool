from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from github import Github, GithubException, InputGitTreeElement

from app.core.config import settings


class GitHubService:
    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = Github(settings.GITHUB_TOKEN)
        return self._client

    @property
    def repo(self):
        return self.client.get_repo(settings.GITHUB_REPO)

    async def commit_config(
        self,
        device_uid: str,
        hostname: str,
        ip_address: str,
        vendor: str,
        content: str,
    ) -> str:
        """
        device_uid/ klasörüne iki dosyayı tek atomik commit ile yazar:
          - running-config.txt  (cihaz config çıktısı)
          - _device_info.yaml   (hostname, ip, vendor — her backup'ta güncellenir)

        Commit mesajı: [hostname · ip] auto-backup timestamp
        """
        now_utc = datetime.now(timezone.utc)
        now_local = now_utc.astimezone(ZoneInfo("Europe/Istanbul"))
        date_str = now_local.strftime("%Y-%m-%d")
        time_str = now_local.strftime("%H:%M")
        commit_message = f"{hostname} - {date_str} - {time_str}"

        device_info = (
            f"hostname: {hostname}\n"
            f"ip_address: {ip_address}\n"
            f"vendor: {vendor}\n"
            f"device_uid: {device_uid}\n"
            f"last_backup: {now_utc.isoformat()}\n"
        )

        repo = self.repo
        branch = repo.default_branch
        ref = repo.get_git_ref(f"heads/{branch}")
        latest_commit = repo.get_git_commit(ref.object.sha)
        base_tree = latest_commit.tree

        info_blob = repo.create_git_blob(device_info, "utf-8")
        config_blob = repo.create_git_blob(content, "utf-8")

        tree = repo.create_git_tree(
            [
                InputGitTreeElement(
                    path=f"{device_uid}/_device_info.yaml",
                    mode="100644",
                    type="blob",
                    sha=info_blob.sha,
                ),
                InputGitTreeElement(
                    path=f"{device_uid}/running-config.txt",
                    mode="100644",
                    type="blob",
                    sha=config_blob.sha,
                ),
            ],
            base_tree,
        )

        new_commit = repo.create_git_commit(commit_message, tree, [latest_commit])
        ref.edit(new_commit.sha)

        return f"{device_uid}/running-config.txt"

    async def list_configs(self, device_uid: str) -> list[dict]:
        """Cihaza ait tüm config commit'lerini listeler.
        _device_info.yaml her backupda last_backup timestamp'iyle değiştiği için
        config aynı kalsa bile her backup kaydı listede görünür."""
        try:
            commits = self.repo.get_commits(path=f"{device_uid}/_device_info.yaml")
            return [
                {
                    "sha": c.sha,
                    "message": c.commit.message,
                    "date": c.commit.author.date.isoformat(),
                }
                for c in commits
            ]
        except GithubException:
            return []

    async def get_config(self, device_uid: str, sha: str | None = None) -> str | None:
        """Belirtilen commit'teki (ya da en güncel) running-config.txt içeriğini döndürür."""
        path = f"{device_uid}/running-config.txt"
        try:
            if sha:
                content = self.repo.get_contents(path, ref=sha)
            else:
                content = self.repo.get_contents(path)
            return content.decoded_content.decode()
        except GithubException:
            return None
