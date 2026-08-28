from app.services.restore_strategies.base import BaseRestoreStrategy
from app.services.restore_strategies.cisco_ios import CiscoIosRestoreStrategy
from app.services.restore_strategies.aruba_cx import ArubaCxRestoreStrategy
from app.services.restore_strategies.huawei import HuaweiRestoreStrategy, HUAWEI_REBOOT_WARNING
from app.services.restore_strategies.fortigate import FortiGateRestoreStrategy
from app.services.restore_strategies.paloalto import PaloAltoRestoreStrategy

# aruba (ArubaOS-Switch, klasik CLI) kapsam dışı — restore desteklenmiyor.
_STRATEGIES = {
    "cisco": CiscoIosRestoreStrategy,
    "fortigate": FortiGateRestoreStrategy,
    "huawei": HuaweiRestoreStrategy,
    "aruba_cx": ArubaCxRestoreStrategy,
    "paloalto": PaloAltoRestoreStrategy,
}


def get_restore_strategy(vendor: str) -> BaseRestoreStrategy | None:
    """Vendor string'ine göre restore stratejisi döndürür. Eşleşme yoksa None."""
    cls = _STRATEGIES.get((vendor or "").lower())
    return cls() if cls else None
