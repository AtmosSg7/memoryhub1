from typing import List, Literal



from pydantic import BaseModel, ConfigDict, Field



ReminderType = Literal[

    "invoice_overdue",

    "invoice_unpaid",

    "invoice_due_soon",

    "quote_no_response",

    "quote_expiring_soon",

    "quote_accepted_pending_invoice",

]



ReminderPriority = Literal["low", "medium", "high", "critical"]



PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}





class ReminderPublic(BaseModel):

    model_config = ConfigDict(extra="ignore")



    id: str

    type: ReminderType

    priority: ReminderPriority

    title: str

    description: str

    link: str

    date: str

    resolved: bool = False





class ReminderListResponse(BaseModel):

    items: List[ReminderPublic]

    total: int = Field(..., ge=0)

