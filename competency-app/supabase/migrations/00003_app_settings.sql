-- App settings (key/value store)
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Trigger for updated_at
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_settings_insert" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'super_admin'));

CREATE POLICY "app_settings_update" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

-- Insert default chart colors
INSERT INTO public.app_settings (key, value) VALUES (
  'chart_colors',
  '{"actual": "#8b5cf6", "expected": "#9ca3af"}'::jsonb
);
