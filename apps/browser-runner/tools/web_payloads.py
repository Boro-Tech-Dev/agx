"""Pydantic request payloads and env-derived limits (no FastAPI app / Playwright runtime)."""

from __future__ import annotations

import os
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from .capture_helpers import BrowserStagingOptions
from .capture_options import CaptureRequestOptions
from .interaction_plan import InteractionPlanStep, validate_plan_length

NAV_TIMEOUT_MS = int(os.getenv('WEB_NAV_TIMEOUT_MS', '45000'))
MAX_TEXT_RESPONSE_CHARS = int(os.getenv('WEB_MAX_TEXT_CHARS', '24000'))
MAX_CRAWL_PAGES = int(os.getenv('WEB_MAX_CRAWL_PAGES', '25'))
MAX_CRAWL_DEPTH = int(os.getenv('WEB_MAX_CRAWL_DEPTH', '4'))
MAX_CRAWL_SECONDS = float(os.getenv('WEB_MAX_CRAWL_SECONDS', '120'))
MAX_CRAWL_ARTICLE_CHARS = int(os.getenv('WEB_MAX_CRAWL_ARTICLE_CHARS', '12000'))
MAX_EXCERPT = int(os.getenv('WEB_MAX_EXCERPT_CHARS', '600'))
HTTP_TIMEOUT_SEC = float(os.getenv('WEB_HTTP_TIMEOUT_SEC', '30'))

PdfFormat = Literal['A4', 'Letter']


class ScreenshotPayload(BaseModel):
    url: str
    full_page: bool = False
    viewport_width: int = Field(default=1280, ge=320, le=3840)
    viewport_height: int = Field(default=720, ge=240, le=2160)
    device_scale_factor: float = Field(default=2.0, ge=1.0, le=4.0)
    omit_background: bool = False
    include_interactives: bool = False
    interaction_plan: Optional[List[InteractionPlanStep]] = None
    staging: BrowserStagingOptions = Field(default_factory=BrowserStagingOptions)
    record_har: bool = False
    debug_on_failure: bool = False

    @model_validator(mode='after')
    def _cap_interaction_plan(self) -> ScreenshotPayload:
        validate_plan_length(self.interaction_plan)
        return self

    def capture_options(self) -> CaptureRequestOptions:
        return CaptureRequestOptions(record_har=self.record_har, debug_on_failure=self.debug_on_failure)


class ExtractPayload(BaseModel):
    url: str
    render_js: bool = True
    include_interactives: bool = False
    interaction_plan: Optional[List[InteractionPlanStep]] = None
    staging: BrowserStagingOptions = Field(default_factory=BrowserStagingOptions)
    record_har: bool = False
    debug_on_failure: bool = False

    @model_validator(mode='after')
    def _cap_interaction_plan_extract(self) -> ExtractPayload:
        validate_plan_length(self.interaction_plan)
        return self

    def capture_options(self) -> CaptureRequestOptions:
        return CaptureRequestOptions(record_har=self.record_har, debug_on_failure=self.debug_on_failure)


class PdfPayload(BaseModel):
    url: str
    format: PdfFormat = 'A4'
    print_background: bool = True
    viewport_width: int = Field(default=1280, ge=320, le=3840)
    viewport_height: int = Field(default=720, ge=240, le=2160)
    include_interactives: bool = False
    interaction_plan: Optional[List[InteractionPlanStep]] = None
    staging: BrowserStagingOptions = Field(default_factory=BrowserStagingOptions)
    record_har: bool = False
    debug_on_failure: bool = False

    @model_validator(mode='after')
    def _cap_plan(self) -> PdfPayload:
        validate_plan_length(self.interaction_plan)
        return self

    def capture_options(self) -> CaptureRequestOptions:
        return CaptureRequestOptions(record_har=self.record_har, debug_on_failure=self.debug_on_failure)


class CrawlPayload(BaseModel):
    url: str
    max_depth: int = Field(default=3, ge=0, le=MAX_CRAWL_DEPTH)
    max_pages: int = Field(default=15, ge=1, le=MAX_CRAWL_PAGES)
    same_site_only: bool = True
    inter_page_delay_ms: int = Field(default=2000, ge=0, le=120_000)
    include_full_text: bool = True
    include_interactives: bool = False
    include_pdfs: bool = True
    pdf_format: PdfFormat = 'A4'
    pdf_print_background: bool = True
    interaction_plan: Optional[List[InteractionPlanStep]] = None
    auto_dismiss_gates: bool = True
    staging: BrowserStagingOptions = Field(default_factory=BrowserStagingOptions)
    record_har: bool = False
    debug_on_failure: bool = False

    @model_validator(mode='after')
    def _cap_crawl_plan(self) -> CrawlPayload:
        validate_plan_length(self.interaction_plan)
        return self

    def capture_options(self) -> CaptureRequestOptions:
        return CaptureRequestOptions(record_har=self.record_har, debug_on_failure=self.debug_on_failure)
