from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class TopologyNeighbor(Base):
    __tablename__ = "topology_neighbors"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    neighbor_hostname = Column(String, nullable=True)
    neighbor_ip = Column(String, nullable=True)
    local_port = Column(String, nullable=True)
    neighbor_port = Column(String, nullable=True)
    protocol = Column(String(10), default="lldp")
    discovered_device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    last_discovered_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    device = relationship("Device", foreign_keys=[device_id])
    discovered_device = relationship("Device", foreign_keys=[discovered_device_id])
