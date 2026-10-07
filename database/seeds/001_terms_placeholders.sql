-- Placeholder terms versions so the §9 acceptance gate can be built and tested.
-- Replace with the client's legal text before launch (publish a new version via
-- the admin endpoint; never edit an accepted version). Idempotent.

INSERT INTO terms_versions (doc, version, title, content_md, is_current)
VALUES
  ('terms_of_use',   '0.0-placeholder', 'Terms of Use',   'Placeholder: awaiting client legal text. See docs/TERMS_OF_USE.md.', true),
  ('privacy_policy', '0.0-placeholder', 'Privacy Policy', 'Placeholder: awaiting client legal text. See docs/PRIVACY_POLICY.md.', true)
ON CONFLICT (doc, version) DO NOTHING;
