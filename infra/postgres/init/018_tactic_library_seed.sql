-- Seed tactic library from config/tactic_library/catalog.json
BEGIN;
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('hcp_email', 'HCP email', 'Permissions-based professional email', 'paid_media', 'digital', 'email', 'message', '["hcp","b2b"]'::jsonb, 'active', '{"timing_profile":"email"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('dtc_email', 'Consumer / DTC email', 'Direct-to-consumer promotional email', 'paid_media', 'digital', 'email', 'message', '["dtc","b2c"]'::jsonb, 'active', '{"timing_profile":"email_linear"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('crm_email', 'CRM / lifecycle email', 'Triggered or newsletters via CRM', 'owned', 'digital', 'email', 'message', '["crm"]'::jsonb, 'active', '{"timing_profile":"email_linear"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('paid_search_sem', 'Paid search (SEM)', 'Search engine marketing text ads', 'paid_media', 'digital', 'search', 'text', '["sem","ppc"]'::jsonb, 'active', '{"timing_profile":"sem_seo"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('seo_organic', 'Organic SEO', 'Technical and content SEO', 'owned', 'digital', 'search', 'web', '["seo"]'::jsonb, 'active', '{"timing_profile":"sem_seo"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('paid_social_feed', 'Paid social – feed', 'In-feed sponsored posts', 'paid_media', 'digital', 'social', 'feed', '["social"]'::jsonb, 'active', '{"timing_profile":"social_paid"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('paid_social_stories', 'Paid social – stories/reels', 'Full-screen vertical sponsored units', 'paid_media', 'digital', 'social', 'stories', '["social"]'::jsonb, 'active', '{"timing_profile":"social_paid"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('paid_social_video', 'Paid social – in-feed video', 'Short-form sponsored video in social', 'paid_media', 'digital', 'social', 'video', '["social"]'::jsonb, 'active', '{"timing_profile":"social_paid"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('organic_social', 'Organic social', 'Brand-operated social content', 'owned', 'digital', 'social', 'mixed', '["organic"]'::jsonb, 'active', '{"timing_profile":"social_paid"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('programmatic_display', 'Programmatic display', 'Open-web display via DSP', 'paid_media', 'digital', 'display', 'banner', '["programmatic"]'::jsonb, 'active', '{"timing_profile":"display_standard"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('programmatic_video_olv', 'Programmatic online video', 'OLV / pre-roll outside walled gardens', 'paid_media', 'digital', 'video', 'in_stream', '["olv"]'::jsonb, 'active', '{"timing_profile":"display_standard"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('ctv_bvod', 'CTV / BVOD', 'Connected TV and broadcaster VOD', 'paid_media', 'digital', 'ctv', 'in_stream', '["ctv"]'::jsonb, 'active', '{"timing_profile":"ctv_streaming"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('digital_audio_streaming', 'Streaming digital audio', 'Music/podcast app audio ads', 'paid_media', 'digital', 'audio', 'spot', '["audio"]'::jsonb, 'active', '{"timing_profile":"audio_podcast_streaming"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('podcast_host_read', 'Podcast host-read', 'Integrated podcast endorsements', 'paid_media', 'digital', 'audio', 'host_read', '["podcast"]'::jsonb, 'active', '{"timing_profile":"audio_podcast_streaming"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('retail_media_network', 'Retail media network', 'Ads on retailer sites/apps', 'paid_media', 'digital', 'retail', 'mixed', '["commerce"]'::jsonb, 'active', '{"timing_profile":"retail_media"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('commerce_search', 'Commerce search', 'Retail site sponsored search', 'paid_media', 'digital', 'retail', 'search', '["commerce"]'::jsonb, 'active', '{"timing_profile":"retail_media"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('endemic_display', 'Endemic publisher display', 'Vertical endemic site display', 'paid_media', 'digital', 'publisher', 'banner', '["endemic"]'::jsonb, 'active', '{"timing_profile":"endemic_publisher"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('endemic_email', 'Endemic publisher email', 'Dedicated sends via endemic partners', 'paid_media', 'digital', 'publisher', 'email', '["endemic"]'::jsonb, 'active', '{"timing_profile":"endemic_publisher"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('sms_marketing', 'SMS marketing', 'Opt-in promotional SMS', 'paid_media', 'digital', 'mobile', 'sms', '["sms"]'::jsonb, 'active', '{"timing_profile":"sms_push"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('push_notifications', 'Mobile push', 'App push notifications', 'owned', 'digital', 'mobile', 'push', '["push"]'::jsonb, 'active', '{"timing_profile":"sms_push"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('influencer_paid', 'Paid influencer', 'Sponsored creator posts', 'paid_media', 'digital', 'social', 'creator', '["influencer"]'::jsonb, 'active', '{"timing_profile":"influencer_creator"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('influencer_organic_seed', 'Creator seeding', 'Product seeding / unpaid advocacy', 'earned', 'digital', 'social', 'creator', '["influencer"]'::jsonb, 'active', '{"timing_profile":"influencer_creator"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('brand_site', 'Brand website', 'Corporate or campaign site', 'owned', 'digital', 'web', 'site', '["website"]'::jsonb, 'active', '{"timing_profile":"website"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('landing_microsite', 'Landing / microsite', 'Campaign landing experiences', 'owned', 'digital', 'web', 'responsive', '["landing"]'::jsonb, 'active', '{"timing_profile":"website"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('mobile_app_experience', 'Mobile app', 'In-app branded modules', 'owned', 'digital', 'mobile', 'app', '["app"]'::jsonb, 'active', '{"timing_profile":"mobile_app_web"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('interactive_rich_media', 'Rich media / interactive', 'Expandables, gamified units', 'paid_media', 'digital', 'display', 'rich_media', '["interactive"]'::jsonb, 'active', '{"timing_profile":"display_standard"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('qr_physical_digital', 'QR bridge', 'QR driving to digital journeys', 'paid_media', 'digital', 'activation', 'qr', '["qr"]'::jsonb, 'active', '{"timing_profile":"display_standard"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('webinar_virtual', 'Webinars / virtual events', 'Live or simulive educational events', 'owned', 'digital', 'events', 'virtual', '["webinar"]'::jsonb, 'active', '{"timing_profile":"webinar_virtual_event"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('virtual_booth', 'Virtual congress booth', 'Digital congress presence', 'paid_media', 'digital', 'events', 'virtual', '["congress"]'::jsonb, 'active', '{"timing_profile":"webinar_virtual_event"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('dooh_digital', 'Digital out-of-home', 'Digital screens OOH', 'paid_media', 'digital', 'ooh', 'digital', '["dooh"]'::jsonb, 'active', '{"timing_profile":"dooh_digital"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('static_ooh_poster', 'Static OOH poster', 'Posters / transit static', 'paid_media', 'offline', 'ooh', 'static', '["ooh"]'::jsonb, 'active', '{"timing_profile":"ooh_static"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('static_ooh_bulletin', 'Bulletins / roadside', 'Large format roadside', 'paid_media', 'offline', 'ooh', 'bulletin', '["ooh"]'::jsonb, 'active', '{"timing_profile":"ooh_static"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('consumer_print_magazine', 'Consumer print magazine', 'Magazine advertising', 'paid_media', 'offline', 'print', 'magazine', '["print"]'::jsonb, 'active', '{"timing_profile":"print_magazine_newspaper"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('trade_print', 'Trade / HCP print journals', 'Professional publication ads', 'paid_media', 'offline', 'print', 'journal', '["hcp","print"]'::jsonb, 'active', '{"timing_profile":"print_magazine_newspaper"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('newspaper_print', 'Newspaper advertising', 'Daily / weekly news print', 'paid_media', 'offline', 'print', 'newspaper', '["print"]'::jsonb, 'active', '{"timing_profile":"print_magazine_newspaper"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('fsi_insert', 'FSI / coupon inserts', 'Freestanding inserts', 'paid_media', 'offline', 'print', 'insert', '["fsi"]'::jsonb, 'active', '{"timing_profile":"print_insert_fsi"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('direct_mail', 'Direct mail', 'Postcard / letter packs', 'paid_media', 'offline', 'direct', 'mail', '["direct_mail"]'::jsonb, 'active', '{"timing_profile":"direct_mail"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('brochure_leave_behind_print', 'Print brochure leave-behind', 'Rep-delivered print brochures', 'paid_media', 'offline', 'print', 'brochure', '["collateral"]'::jsonb, 'active', '{"timing_profile":"collateral_leave_behind"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('flashcards_print', 'Print flashcards / tear pads', 'POC or office tear pads', 'paid_media', 'offline', 'print', 'flashcard', '["poc"]'::jsonb, 'active', '{"timing_profile":"poc_print"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('point_of_care_digital', 'Point-of-care digital', 'Exam-room digital screens', 'paid_media', 'digital', 'poc', 'screen', '["poc"]'::jsonb, 'active', '{"timing_profile":"endemic_publisher"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('point_of_care_print', 'Point-of-care print', 'Waiting-room posters / brochures', 'paid_media', 'offline', 'poc', 'print', '["poc"]'::jsonb, 'active', '{"timing_profile":"poc_print"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('congress_exhibit', 'Congress exhibit graphics', 'Booth panels / hanging signs', 'paid_media', 'offline', 'events', 'exhibit', '["congress"]'::jsonb, 'active', '{"timing_profile":"congress_exhibit_print"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('congress_digital_screen', 'Congress digital signage', 'On-site congress LED / loops', 'paid_media', 'digital', 'events', 'screen', '["congress"]'::jsonb, 'active', '{"timing_profile":"tradeshow_digital"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('sales_aid_clm', 'CLM / sales aid', 'Closed-loop field sales materials', 'owned', 'digital', 'field', 'tablet', '["clm"]'::jsonb, 'active', '{"timing_profile":"clm"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('slide_deck_scientific', 'Scientific slide deck', 'MLR-tracked scientific decks', 'owned', 'digital', 'sales', 'slides', '["slides"]'::jsonb, 'active', '{"timing_profile":"clm"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('video_ad_production', 'Video ad production', 'Hero spots for broadcast / digital', 'production', 'cross', 'video', 'spot', '["video"]'::jsonb, 'active', '{"timing_profile":"video_production"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('long_form_video', 'Long-form video', 'Extended brand or MOA films', 'production', 'cross', 'video', 'long_form', '["video"]'::jsonb, 'active', '{"timing_profile":"video_production"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('animation_moa', 'Animation / MOA', 'Mechanism of action animation', 'production', 'cross', 'video', 'animation', '["animation"]'::jsonb, 'active', '{"timing_profile":"animation"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('banner_standard_iab', 'Standard IAB banners', 'Leaderboard / MPU web banners', 'paid_media', 'digital', 'display', 'banner', '["display"]'::jsonb, 'active', '{"timing_profile":"banner"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('native_advertising', 'Native advertising', 'In-feed native units', 'paid_media', 'digital', 'publisher', 'native', '["native"]'::jsonb, 'active', '{"timing_profile":"endemic_publisher"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('affiliate_marketing', 'Affiliate / partner', 'Performance partner publishers', 'paid_media', 'digital', 'partner', 'mixed', '["affiliate"]'::jsonb, 'active', '{"timing_profile":"display_standard"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_tactic_1', 'HappyGuy Tactic 1', 'HappyGuy baseline delivery (Thursday/Tuesday PRB anchors; OPDP binder profile)', 'owned', 'other', 'mixed', 'mixed', '["happyguy","delivery"]'::jsonb, 'active', '{"timing_profile":"happyguy_submit_thursday"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
-- HappyGuy MAD tactics: mirrored in infra/postgres/seeds/005_happyguy_mad_tactics.sql for targeted re-apply on existing volumes.
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_mad_healthgrades_360_email', 'HappyGuy MAD — Healthgrades 360 email', 'Vendor screenshot cycles, resubmit path, OPDP; HappyGuy week-aligned PRB', 'owned', 'digital', 'email', 'html', '["happyguy","mad","healthgrades","email"]'::jsonb, 'active', '{"timing_profile":"happyguy_mad_healthgrades_360_email"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_mad_patient_profiles_tll', 'HappyGuy MAD — Patient profiles (TLL)', 'TLL alignment, profile creative, extended post-PRB1 revision track; HappyGuy week-aligned PRB', 'owned', 'other', 'mixed', 'mixed', '["happyguy","mad","patient_profiles","tll"]'::jsonb, 'active', '{"timing_profile":"happyguy_mad_patient_profiles_tll"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_mad_liver_brochure_training_blueprint', 'HappyGuy MAD — Liver brochure / training blueprint', 'Tighter discovery, layout + accessibility/fact-check overlap; HappyGuy week-aligned PRB', 'owned', 'print', 'brochure', 'pdf', '["happyguy","mad","brochure","training"]'::jsonb, 'active', '{"timing_profile":"happyguy_mad_liver_brochure_training_blueprint"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_aasld_hotel_key_cards', 'HappyGuy — AASLD Hotel Key Cards', 'Congress hotel key card pick-up/revise; AASLD review, FDA 2253, print release', 'owned', 'print', 'congress', 'hotel_key_card', '["happyguy","aasld","congress","print","hotel_key_cards"]'::jsonb, 'active', '{"timing_profile":"happyguy_aasld_congress_print_pickup"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_aasld_wifi_splash_page', 'HappyGuy — AASLD Wifi Splash Page', 'Congress wifi splash page pick-up/revise; AASLD TENT review, file release, congress handoff', 'owned', 'digital', 'congress', 'wifi_splash', '["happyguy","aasld","congress","digital","wifi_splash"]'::jsonb, 'active', '{"timing_profile":"happyguy_aasld_congress_print_pickup"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_mps_website_updates', 'HappyGuy — MPS Website Updates', 'Figma/PRC website update; extended OPDP, FDA, production deploy, post-launch QA', 'owned', 'digital', 'website', 'web', '["happyguy","mps","website","prc","opdp"]'::jsonb, 'active', '{"timing_profile":"happyguy_mps_website_update"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();

INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_branded_crm_emails', 'HappyGuy — Branded CRM Email Updates', 'Branded CRM email update; 3 PRC rounds, OPDP binder, Martech test blasts, FDA 2253', 'owned', 'digital', 'email', 'html', '["happyguy","crm","email","prc","opdp","martech"]'::jsonb, 'active', '{"timing_profile":"happyguy_branded_crm_email"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
COMMIT;
