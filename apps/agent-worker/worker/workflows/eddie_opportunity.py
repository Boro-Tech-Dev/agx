from .common import context_messages, route_model, fallback


async def run(run_id, workflow, content, project_key, inp, mems):
    routed = await route_model(
        'eddie',
        workflow,
        context_messages('eddie', content, mems),
        run_id=run_id,
    )
    return (
        routed.get('parsed')
        or (
            fallback('eddie', content, {}, mems)
            if routed.get('error')
            else {
                'portfolio_summary': routed.get('content', ''),
                'opportunities': [],
                'recommended_next_actions': [],
            }
        )
    ), routed
