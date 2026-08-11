-- =====================================================================
--  مذاقي توب — التراجع الكامل عن إعداد لوحة التحكم
--  يحذف كائنات مذاقي توب فقط، ولا يمسّ أي شيء آخر في المشروع.
-- =====================================================================

drop policy if exists mathaqi_media_read   on storage.objects;
drop policy if exists mathaqi_media_insert on storage.objects;
drop policy if exists mathaqi_media_update on storage.objects;
drop policy if exists mathaqi_media_delete on storage.objects;

-- احذف الملفات المرفوعة أولاً ثم الدلو
delete from storage.objects where bucket_id = 'mathaqi-media';
delete from storage.buckets where id = 'mathaqi-media';

drop table if exists public.mathaqi_items      cascade;
drop table if exists public.mathaqi_categories cascade;
drop table if exists public.mathaqi_offers     cascade;
drop table if exists public.mathaqi_dishes     cascade;
drop table if exists public.mathaqi_settings   cascade;
drop table if exists public.mathaqi_admins     cascade;

drop function if exists public.mathaqi_is_admin();
drop function if exists public.mathaqi_touch_updated_at();
