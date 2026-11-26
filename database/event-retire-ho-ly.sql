-- Keep final receipts/history for administration; retire student-facing event access.
REVOKE EXECUTE ON FUNCTION public.ikigai_event_ho_ly_state() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION ikigai_event_private.state() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
