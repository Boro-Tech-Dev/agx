import base64

from tools.web_payloads import CrawlPayload, ExtractPayload, PdfPayload, ScreenshotPayload


def test_extract_defaults_browser_first() -> None:
    p = ExtractPayload(url='https://example.com/')
    assert p.render_js is True


def test_crawl_gentle_defaults() -> None:
    p = CrawlPayload(url='https://example.com/')
    assert p.inter_page_delay_ms == 2000
    assert p.include_full_text is True
    assert p.include_interactives is False
    assert p.include_pdfs is True
    assert p.pdf_format == 'A4'
    assert p.max_depth == 3
    assert p.max_pages == 15
    assert p.auto_dismiss_gates is True


def test_screenshot_accepts_interaction_plan() -> None:
    from tools.interaction_plan import InteractionPlanStep

    p = ScreenshotPayload(
        url='https://example.com/',
        interaction_plan=[
            InteractionPlanStep(action='click', selector='#x'),
            InteractionPlanStep(action='wait_ms', wait_ms=10),
        ],
    )
    assert p.interaction_plan is not None
    assert len(p.interaction_plan) == 2


def test_crawl_delay_bounds() -> None:
    p = CrawlPayload(url='https://example.com/', inter_page_delay_ms=500)
    assert p.inter_page_delay_ms == 500


def test_fast_extract_explicit() -> None:
    p = ExtractPayload(url='https://example.com/', render_js=False)
    assert p.render_js is False


def test_pdf_payload_and_capture_flags() -> None:
    p = PdfPayload(url='https://example.com/', record_har=True, debug_on_failure=True)
    opts = p.capture_options()
    assert opts.record_har is True
    assert opts.debug_on_failure is True


def test_crawl_interaction_plan_and_upload_step() -> None:
    from tools.interaction_plan import InteractionPlanStep

    tiny = base64.standard_b64encode(b'%PDF-1.4').decode('ascii')
    p = CrawlPayload(
        url='https://example.com/',
        interaction_plan=[
            InteractionPlanStep(
                action='upload',
                selector='input[type=file]',
                file_base64=tiny,
                filename='doc.pdf',
            ),
        ],
    )
    assert p.interaction_plan is not None
    assert p.interaction_plan[0].action == 'upload'
