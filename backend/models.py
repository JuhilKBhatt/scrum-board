from sqlalchemy import Column, Integer, String, Text
from database import Base

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String, index=True, nullable=False)
    task_owner = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String, default="Backlog", nullable=False) # Backlog, In Progress, Review, Done
