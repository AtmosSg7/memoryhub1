"""Communication Hub V2 — API / persistence shapes."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

LifecycleStatus = Literal[
    "new", "to_read", "read", "replied", "waiting", "archived", "ignored"
]
Priority = Literal["low", "normal", "high", "urgent"]


class HubAttachmentPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    conversationId: Optional[str] = None
    communicationId: Optional[str] = None
    filename: Optional[str] = None
    mimeType: Optional[str] = None
    size: Optional[int] = None
    kind: str = "other"
    channel: Optional[str] = None
    provider: Optional[str] = None
    externalUrl: Optional[str] = None
    createdAt: Optional[str] = None


class HubParticipantPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    identityKey: Optional[str] = None
    displayName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None  # from | to | self


class HubMessagePublic(BaseModel):
    """Single communication inside a conversation (Hub read model)."""

    model_config = ConfigDict(extra="ignore")

    id: str
    conversationId: Optional[str] = None
    channel: str
    provider: Optional[str] = None
    providerId: Optional[str] = None
    direction: Optional[str] = None
    subject: Optional[str] = None
    preview: Optional[str] = None
    lifecycleStatus: str = "new"
    associationStatus: Optional[str] = None
    clientId: Optional[str] = None
    priority: str = "normal"
    attachmentsCount: int = 0
    attachments: List[HubAttachmentPublic] = Field(default_factory=list)
    externalUrl: Optional[str] = None
    createdAt: str
    participants: List[HubParticipantPublic] = Field(default_factory=list)
    availableActions: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class HubConversationPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    conversationKey: str
    channel: str
    provider: Optional[str] = None
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    subject: Optional[str] = None
    preview: Optional[str] = None
    lifecycleStatus: str = "new"
    priority: str = "normal"
    messageCount: int = 0
    attachmentCount: int = 0
    participants: List[HubParticipantPublic] = Field(default_factory=list)
    lastMessageAt: Optional[str] = None
    firstMessageAt: Optional[str] = None
    externalUrl: Optional[str] = None
    unreadCount: int = 0
    availableActions: List[str] = Field(default_factory=list)


class HubConversationDetailResponse(BaseModel):
    conversation: HubConversationPublic
    messages: List[HubMessagePublic]
    attachments: List[HubAttachmentPublic] = Field(default_factory=list)


class HubConversationListResponse(BaseModel):
    items: List[HubConversationPublic]
    total: int
    offset: int = 0
    limit: int = 50


class ClientInboxChannelGroup(BaseModel):
    channel: str
    conversations: List[HubConversationPublic]
    total: int = 0


class ClientInboxResponse(BaseModel):
    clientId: str
    channels: List[ClientInboxChannelGroup]
    totalConversations: int = 0
    totalMessages: int = 0
    offset: int = 0
    limit: int = 50
    hasMore: bool = False


class LifecycleUpdateRequest(BaseModel):
    lifecycleStatus: LifecycleStatus


class LifecycleUpdateResponse(BaseModel):
    id: str
    lifecycleStatus: str
    conversationId: Optional[str] = None


class HubMigrateResponse(BaseModel):
    scanned: int
    conversationsUpserted: int
    communicationsUpdated: int
    attachmentsUpserted: int
