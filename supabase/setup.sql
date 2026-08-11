-- =====================================================================
--  مذاقي توب — إعداد قاعدة بيانات لوحة التحكم
--  Mathaqi Top — one-shot CMS setup for Supabase
--
--  كيف تشغّله:
--    Supabase Dashboard ← SQL Editor ← New query ← الصق هذا الملف ← Run
--
--  آمن تماماً على أي مشروع قائم:
--    • كل الكائنات مسبوقة بـ mathaqi_ ولا تلمس أي جدول موجود.
--    • لا يغيّر أي إعداد مشترك في المشروع.
--    • قابل للتراجع بالكامل عبر supabase/teardown.sql.
--    • إعادة تشغيله مرة أخرى لا تضرّ (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) الجداول
-- ---------------------------------------------------------------------

-- من يملك صلاحية التعديل
create table if not exists public.mathaqi_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  label      text,
  created_at timestamptz not null default now()
);

create or replace function public.mathaqi_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.mathaqi_admins a where a.user_id = auth.uid());
$$;

-- إعدادات الموقع (أرقام التواصل، العنوان، الأوقات، النصوص العامة)
create table if not exists public.mathaqi_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- تصنيفات المنيو — كل تصنيف سلايد أفقي
create table if not exists public.mathaqi_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name_ar    text not null,
  name_en    text,
  icon       text not null default 'ic-utensils',
  note       text,
  two_prices boolean not null default false,
  col1_label text,
  col2_label text,
  sort       integer not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);

-- أصناف المنيو
create table if not exists public.mathaqi_items (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.mathaqi_categories(id) on delete cascade,
  name        text not null,
  price       numeric(10,2),
  price2      numeric(10,2),
  price_note  text,
  sort        integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists mathaqi_items_category_idx on public.mathaqi_items (category_id, sort);

-- العروض
create table if not exists public.mathaqi_offers (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text,
  badge      text,
  badge_gold boolean not null default false,
  old_price  numeric(10,2),
  new_price  numeric(10,2),
  price_text text,
  image_url  text,
  image_fit  text not null default 'contain',
  featured   boolean not null default false,
  big_text   text,
  sort       integer not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now(),
  constraint mathaqi_offers_fit_chk check (image_fit in ('contain','cover','round','none'))
);

-- أطباقنا الأكثر طلباً
create table if not exists public.mathaqi_dishes (
  id         uuid primary key default gen_random_uuid(),
  name_ar    text not null,
  name_en    text,
  image_url  text,
  image_fit  text not null default 'contain',
  sort       integer not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now(),
  constraint mathaqi_dishes_fit_chk check (image_fit in ('contain','cover'))
);

-- تحديث تلقائي لوقت التعديل
create or replace function public.mathaqi_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mathaqi_settings_touch on public.mathaqi_settings;
create trigger mathaqi_settings_touch
  before update on public.mathaqi_settings
  for each row execute function public.mathaqi_touch_updated_at();

-- ---------------------------------------------------------------------
-- 2) الصلاحيات (RLS) — العالم يقرأ المنشور، والمدير وحده يكتب
-- ---------------------------------------------------------------------
alter table public.mathaqi_admins     enable row level security;
alter table public.mathaqi_settings   enable row level security;
alter table public.mathaqi_categories enable row level security;
alter table public.mathaqi_items      enable row level security;
alter table public.mathaqi_offers     enable row level security;
alter table public.mathaqi_dishes     enable row level security;

drop policy if exists mathaqi_admins_read on public.mathaqi_admins;
create policy mathaqi_admins_read on public.mathaqi_admins
  for select to authenticated using (public.mathaqi_is_admin());

drop policy if exists mathaqi_settings_read  on public.mathaqi_settings;
drop policy if exists mathaqi_settings_write on public.mathaqi_settings;
create policy mathaqi_settings_read on public.mathaqi_settings
  for select to anon, authenticated using (true);
create policy mathaqi_settings_write on public.mathaqi_settings
  for all to authenticated using (public.mathaqi_is_admin()) with check (public.mathaqi_is_admin());

drop policy if exists mathaqi_categories_read  on public.mathaqi_categories;
drop policy if exists mathaqi_categories_write on public.mathaqi_categories;
create policy mathaqi_categories_read on public.mathaqi_categories
  for select to anon, authenticated using (visible or public.mathaqi_is_admin());
create policy mathaqi_categories_write on public.mathaqi_categories
  for all to authenticated using (public.mathaqi_is_admin()) with check (public.mathaqi_is_admin());

drop policy if exists mathaqi_items_read  on public.mathaqi_items;
drop policy if exists mathaqi_items_write on public.mathaqi_items;
create policy mathaqi_items_read on public.mathaqi_items
  for select to anon, authenticated using (visible or public.mathaqi_is_admin());
create policy mathaqi_items_write on public.mathaqi_items
  for all to authenticated using (public.mathaqi_is_admin()) with check (public.mathaqi_is_admin());

drop policy if exists mathaqi_offers_read  on public.mathaqi_offers;
drop policy if exists mathaqi_offers_write on public.mathaqi_offers;
create policy mathaqi_offers_read on public.mathaqi_offers
  for select to anon, authenticated using (visible or public.mathaqi_is_admin());
create policy mathaqi_offers_write on public.mathaqi_offers
  for all to authenticated using (public.mathaqi_is_admin()) with check (public.mathaqi_is_admin());

drop policy if exists mathaqi_dishes_read  on public.mathaqi_dishes;
drop policy if exists mathaqi_dishes_write on public.mathaqi_dishes;
create policy mathaqi_dishes_read on public.mathaqi_dishes
  for select to anon, authenticated using (visible or public.mathaqi_is_admin());
create policy mathaqi_dishes_write on public.mathaqi_dishes
  for all to authenticated using (public.mathaqi_is_admin()) with check (public.mathaqi_is_admin());

-- ---------------------------------------------------------------------
-- 3) تخزين الصور — دلو مستقل لمذاقي توب وحده
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('mathaqi-media', 'mathaqi-media', true)
on conflict (id) do nothing;

drop policy if exists mathaqi_media_read   on storage.objects;
drop policy if exists mathaqi_media_insert on storage.objects;
drop policy if exists mathaqi_media_update on storage.objects;
drop policy if exists mathaqi_media_delete on storage.objects;

create policy mathaqi_media_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'mathaqi-media');

create policy mathaqi_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'mathaqi-media' and public.mathaqi_is_admin());

create policy mathaqi_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'mathaqi-media' and public.mathaqi_is_admin())
  with check (bucket_id = 'mathaqi-media' and public.mathaqi_is_admin());

create policy mathaqi_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'mathaqi-media' and public.mathaqi_is_admin());

-- ---------------------------------------------------------------------
-- 4) البيانات الأولية — نفس محتوى الموقع الحالي حرفياً
--    (تُدرج مرة واحدة فقط؛ إعادة التشغيل لا تكرّرها ولا تدهس تعديلاتك)
-- ---------------------------------------------------------------------

-- الإعدادات
insert into public.mathaqi_settings (key, value) values
  ('contact', jsonb_build_object(
      'phone1', '738696360',
      'phone2', '777560447',
      'whatsapp', '967738696360',
      'address', 'الحديدة — شارع صنعاء، أمام كلية الشفاء',
      'hours', 'يومياً — من العصر حتى منتصف الليل',
      'open_from', 16,
      'open_to', 24,
      'instagram', 'https://www.instagram.com/mathaqitop',
      'maps', 'https://maps.app.goo.gl/gJ9Fp4Zu8NTLTEW49'
   )),
  ('hero', jsonb_build_object(
      'eyebrow', 'مطعم وكافيه · الحديدة',
      'title_1', 'نكهةٌ تُطرِب المذاق',
      'title_2', 'مذاقي توب',
      'subtitle', 'شاورما ع الفحم، برجر، بيتزا، بروست، زنجر وفاهيتا — تُحضَّر طازجة يومياً بأيدٍ ماهرة ونكهةٍ تُدمن.'
   )),
  ('sections', jsonb_build_object(
      'menu_kicker', 'قائمة الطعام',
      'menu_title', 'منيو مذاقي توب',
      'menu_text', 'اختر التصنيف أو اسحب أفقياً لتصفّح الأصناف.',
      'dishes_kicker', 'من مطبخنا',
      'dishes_title', 'أطباقنا الأكثر طلباً',
      'dishes_text', 'تشكيلة من أشهى أطباقنا، تُحضَّر بعناية ونكهةٍ تُطرب المذاق.',
      'offers_kicker', 'وفّر أكثر',
      'offers_title', 'عروض مذاقي توب',
      'offers_text', 'عروض الخميس والجمعة وأكثر — اسحب لاستعراض كل العروض.'
   )),
  ('rating', jsonb_build_object('value', 3.9, 'count', 36))
on conflict (key) do nothing;

-- التصنيفات
insert into public.mathaqi_categories (slug, name_ar, name_en, icon, sort, two_prices, col1_label, col2_label, note) values
  ('shawarma', 'شاورما ع الفحم', 'Charcoal Shawarma', 'ic-shawarma', 1, false, null, null, null),
  ('burger',   'برجر',           'Burger',            'ic-burger',   2, false, null, null, null),
  ('pizza',    'بيتزا',          'Pizza',             'ic-pizza',    3, true,  'صغير', 'كبير', 'الأسعار بالريال — صغير / كبير'),
  ('broast',   'البروست',        'Broast',            'ic-broast',   4, false, null, null, null),
  ('zinger',   'زنجر',           'Zinger',            'ic-zinger',   5, false, null, null, null),
  ('fajita',   'فاهيتا',         'Fajita',            'ic-fajita',   6, false, null, null, null),
  ('falafel',  'فلافل',          'Falafel',           'ic-falafel',  7, false, null, null, null),
  ('drinks',   'مشروبات',        'Drinks',            'ic-drink',    8, false, null, null, null)
on conflict (slug) do nothing;

-- الأصناف
insert into public.mathaqi_items (category_id, name, price, price2, sort)
select c.id, v.name, v.price, v.price2, v.sort
from (values
  ('shawarma','شاورما عربي',         500::numeric, null::numeric, 1),
  ('shawarma','عربي بالجبن',          700, null, 2),
  ('shawarma','شاورما عربي سادة',     800, null, 3),
  ('shawarma','ساندوتش شاورما',       800, null, 4),
  ('shawarma','سبيشل شاورما',        2000, null, 5),
  ('shawarma','سبيشل شاورما عائلي',  3500, null, 6),

  ('burger','برجر فلافل',             300, null, 1),
  ('burger','برجر تشيز — أجبان',      400, null, 2),
  ('burger','تشكن برجر',              750, null, 3),
  ('burger','برجر لحم',               750, null, 4),
  ('burger','برجر سبايسي لحم',       1000, null, 5),

  ('pizza','أجبان سادة',             2000, 3000, 1),
  ('pizza','أجبان + خضار',           2000, 3000, 2),
  ('pizza','أجبان + دجاج',           2500, 3500, 3),
  ('pizza','بيتزا مذاقي',            3000, 4000, 4),

  ('broast','قطعتين بروست',          1250, null, 1),
  ('broast','أربع قطع بروست',        2500, null, 2),
  ('broast','ثمان قطع بروست',        5000, null, 3),

  ('zinger','زنجر عربي',              700, null, 1),
  ('zinger','برجر زنجر',              850, null, 2),
  ('zinger','صاروخ زنجر',            1300, null, 3),
  ('zinger','ساندوتش زنجر',          1300, null, 4),
  ('zinger','سبيشل زنجر',            2500, null, 5),
  ('zinger','سبيشل عائلي زنجر',      4000, null, 6),

  ('fajita','فاهيتا عربي',            700, null, 1),
  ('fajita','برجر فاهيتا',            850, null, 2),
  ('fajita','صاروخ فاهيتا',          1300, null, 3),
  ('fajita','ساندوتش فاهيتا',        1300, null, 4),
  ('fajita','سبيشل فاهيتا',          2500, null, 5),
  ('fajita','سبيشل فاهيتا عائلي',    4000, null, 6),

  ('falafel','فلافل شامي',            200, null, 1),
  ('falafel','فلافل شامي جبن',        250, null, 2),
  ('falafel','فلافل عربي',            300, null, 3),
  ('falafel','نفر فلافل',             800, null, 4),

  ('drinks','عصير ليمون',             150, null, 1),
  ('drinks','عصير فراولة',            250, null, 2),
  ('drinks','عصير مانجو',             250, null, 3),
  ('drinks','كابتشينو بارد',          250, null, 4),
  ('drinks','مشروبات غازية',          200, null, 5),
  ('drinks','مياه معدنية',            100, null, 6)
) as v(slug, name, price, price2, sort)
join public.mathaqi_categories c on c.slug = v.slug
where not exists (select 1 from public.mathaqi_items i where i.category_id = c.id and i.name = v.name);

-- العروض
insert into public.mathaqi_offers (title, subtitle, badge, badge_gold, old_price, new_price, price_text, image_url, image_fit, featured, big_text, sort)
select * from (values
  ('زنجر أو فاهيتا + شاورما عربي + برجر دجاج','ثلاث وجبات في عرض واحد.','عرض الخميس والجمعة',false,2650::numeric,2000::numeric,null::text,'assets/img/food/zinger.webp','contain',true,null::text,1),
  ('زنجر أو فاهيتا + شاورما عربي + برجر لحم','ثلاث وجبات في عرض واحد.','عرض الخميس والجمعة',false,2800,2300,null,'assets/img/food/shawarma-hero.webp','contain',true,null,2),
  ('٣ برجر لحم','اشترِ ٢ والثالث علينا — لحم طازج.','الثالث مجاناً',false,3000,2000,null,'assets/img/food/burger.webp','contain',false,null,3),
  ('٣ برجر دجاج','اشترِ ٢ والثالث علينا — دجاج مشوي.','الثالث مجاناً',false,2250,1500,null,'assets/img/food/chkburger.webp','contain',false,null,4),
  ('برجر وعصير فراولة','إثنين برجر عليك وإثنين عصير فراولة علينا.','برجر + عصير',true,null,null,'يبدأ 1500','assets/img/food/juice.webp','round',false,null,5),
  ('بيتزا خضار + قطعتين بروست + برجر دجاج','وجبة متكاملة تكفي المجموعة — عرض الخميس والجمعة.','كومبو العائلة',false,4000,3000,null,'assets/img/food/pizza.webp','round',false,null,6),
  ('خصم خاص','سارع بالاستفادة من العروض — خصم ٢٠٪ لطلاب الثانوية.','لطلاب الثانوية',true,null,null,null,null,'none',false,'20%',7)
) as v
where not exists (select 1 from public.mathaqi_offers);

-- الأطباق
insert into public.mathaqi_dishes (name_ar, name_en, image_url, image_fit, sort)
select * from (values
  ('شاورما ع الفحم','Charcoal Shawarma','assets/img/food/shawarma.webp','contain',1),
  ('زنجر سبيشل','Zinger','assets/img/food/zinger.webp','contain',2),
  ('بيتزا مذاقي','Pizza','assets/img/food/pizza.webp','cover',3),
  ('برجر لحم','Beef Burger','assets/img/food/burger.webp','contain',4),
  ('بروست مقرمش','Broast','assets/img/food/broast.webp','cover',5),
  ('برجر دجاج','Chicken Burger','assets/img/food/chkburger.webp','contain',6),
  ('فاهيتا عربي','Fajita','assets/img/food/fajita.webp','cover',7),
  ('فلافل شامي','Falafel','assets/img/food/falafel.webp','cover',8),
  ('عصير فراولة','Fresh Juice','assets/img/food/juice.webp','cover',9)
) as v
where not exists (select 1 from public.mathaqi_dishes);

-- ---------------------------------------------------------------------
-- 5) الخطوة الأخيرة — اربط حسابك كمدير
--
--    أنشئ المستخدم أولاً من:  Authentication ← Users ← Add user
--    (فعّل Auto Confirm User)، ثم شغّل السطر التالي بعد وضع إيميلك:
--
--      insert into public.mathaqi_admins (user_id, label)
--      select id, 'مدير مذاقي توب' from auth.users where email = 'ضع-الإيميل-هنا'
--      on conflict (user_id) do nothing;
--
--    بدون هذه الخطوة لن يستطيع أحد التعديل — وهذا هو المقصود.
-- ---------------------------------------------------------------------
