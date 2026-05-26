import type { LaunchpadCategory, LaunchpadChannel, LaunchpadChecklistItem, LaunchpadSeverity } from './types';

let seq = 0;
function item(
  category: LaunchpadCategory,
  label: string,
  severityIfMissing: LaunchpadSeverity = 'blocker',
  required = true,
  description = '',
): LaunchpadChecklistItem {
  seq += 1;
  return {
    id: `chk_${Date.now().toString(36)}_${seq}_${Math.random().toString(36).slice(2, 6)}`,
    category,
    label,
    description,
    required,
    severityIfMissing,
    status: 'not_started',
  };
}

function commonApproval(): LaunchpadChecklistItem[] {
  return [
    item('approval', 'Client approval confirmed'),
    item('approval', 'Final approval documentation attached'),
    item('approval', 'No unapproved post-approval changes detected'),
  ];
}

function commonDocumentation(): LaunchpadChecklistItem[] {
  return [
    item('documentation', 'Final package archived', 'warning'),
    item('documentation', 'Launch evidence binder started', 'warning'),
    item('documentation', 'Workfront/project status updated', 'warning'),
  ];
}

function commonPostLaunch(): LaunchpadChecklistItem[] {
  return [
    item('post_launch', 'Live proof owner assigned', 'warning'),
    item('post_launch', 'Post-launch screenshot/proof required status confirmed', 'warning'),
    item('post_launch', 'Reporting or performance follow-up owner assigned', 'note', false),
  ];
}

export function checklistForChannel(channel: LaunchpadChannel): LaunchpadChecklistItem[] {
  seq = 0;
  switch (channel) {
    case 'veeva_rte':
      return [
        ...commonApproval(),
        item('approval', 'PRB2 approval confirmed'),
        item('assets', 'HTML shell present'),
        item('assets', 'All expected fragments present'),
        item('assets', 'Images/assets folder complete'),
        item('assets', 'Subject line and preheader final'),
        item('assets', 'ISI/safety content present where required'),
        item('qa', 'RTE preview generated'),
        item('qa', 'Fragment previews reviewed'),
        item('qa', 'Link QA passed'),
        item('qa', 'Final screenshots captured', 'warning'),
        item('tracking', 'CTA URLs confirmed'),
        item('tracking', 'CRM/campaign codes confirmed', 'warning'),
        item('vendor', 'Deployment owner/vendor confirmed'),
        item('vendor', 'Package receipt confirmed by deployment team', 'warning'),
        item('deployment', 'Veeva environment/package destination confirmed'),
        item('deployment', 'Deployment date and time confirmed'),
        ...commonDocumentation(),
        ...commonPostLaunch(),
      ];
    case 'veeva_clm':
      return [
        ...commonApproval(),
        item('approval', 'PRB2 approval confirmed'),
        item('assets', 'CLM package present'),
        item('assets', 'Slide list matches approved asset matrix'),
        item('assets', 'Shared images/media assets present'),
        item('qa', 'CLM preview generated'),
        item('qa', 'Navigation map reviewed'),
        item('qa', 'Tap targets / overlays tested'),
        item('qa', 'Broken navigation check passed'),
        item('tracking', 'Tracking requirement confirmed', 'warning'),
        item('vendor', 'Deployment owner/vendor confirmed'),
        item('deployment', 'CRM/Veeva target environment confirmed'),
        item('deployment', 'Deployment date and post-deploy proof plan confirmed'),
        ...commonDocumentation(),
        ...commonPostLaunch(),
      ];
    case 'media':
      return [
        ...commonApproval(),
        item('assets', 'All contracted sizes present'),
        item('assets', 'Vendor specs confirmed'),
        item('assets', 'Backup/static assets included if required', 'warning'),
        item('qa', 'Visual QA passed'),
        item('qa', 'Clickthrough QA passed'),
        item('tracking', 'Final clickthrough URLs present'),
        item('tracking', 'UTM parameters confirmed'),
        item('tracking', 'Third-party tags/pixels confirmed where required', 'warning'),
        item('vendor', 'Trafficking/vendor package sent'),
        item('vendor', 'Vendor receipt confirmed'),
        item('deployment', 'Flight dates confirmed'),
        ...commonDocumentation(),
        ...commonPostLaunch(),
      ];
    case 'web':
      return [
        ...commonApproval(),
        item('assets', 'Staging URL available'),
        item('assets', 'Final CMS/page content loaded'),
        item('assets', 'Legal/footer/privacy requirements present', 'warning'),
        item('qa', 'Visual QA passed'),
        item('qa', 'Link QA passed'),
        item('qa', 'Mobile/responsive QA passed', 'warning'),
        item('tracking', 'Analytics tags confirmed'),
        item('tracking', 'UTM/redirect behavior tested', 'warning'),
        item('deployment', 'Go-live owner confirmed'),
        item('deployment', 'Redirects and publish time confirmed'),
        ...commonDocumentation(),
        ...commonPostLaunch(),
      ];
    case 'crm_email':
      return [
        ...commonApproval(),
        item('assets', 'HTML and plain-text versions present'),
        item('assets', 'Subject line/preheader/from name approved'),
        item('assets', 'Audience/list and suppression logic confirmed'),
        item('qa', 'Rendering QA passed'),
        item('qa', 'Test send reviewed'),
        item('tracking', 'Links and UTMs confirmed'),
        item('deployment', 'Send date/time confirmed'),
        item('deployment', 'Deployment owner confirmed'),
        ...commonDocumentation(),
        ...commonPostLaunch(),
      ];
    case 'print_pdf':
      return [
        ...commonApproval(),
        item('assets', 'Final mechanical/export present'),
        item('assets', 'Printer/vendor specs confirmed'),
        item('assets', 'Required bleed/crop/safe area confirmed', 'warning'),
        item('qa', 'Final proof reviewed'),
        item('qa', 'Reference/ISI check complete', 'warning'),
        item('vendor', 'Vendor package sent'),
        item('vendor', 'Vendor receipt/proof timing confirmed'),
        item('deployment', 'Release/shipping date confirmed'),
        ...commonDocumentation(),
        ...commonPostLaunch(),
      ];
    default:
      return [
        ...commonApproval(),
        item('assets', 'Final asset file present'),
        item('qa', 'QA or review check complete'),
        item('tracking', 'Tracking requirement confirmed', 'warning'),
        item('vendor', 'Vendor/deployment owner confirmed', 'warning'),
        item('deployment', 'Launch date and release owner confirmed'),
        ...commonDocumentation(),
        ...commonPostLaunch(),
      ];
  }
}
