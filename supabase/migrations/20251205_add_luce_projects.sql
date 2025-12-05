-- Add projects for Luce Mimarlık
-- Run this in Supabase SQL Editor

-- Get Luce Mimarlık company_id first
-- INSERT projects with the company_id

INSERT INTO public.projects (company_id, name, status)
SELECT 
  c.id,
  project_name,
  'active'::project_status
FROM 
  (SELECT id FROM public.companies WHERE name = 'Luce Mimarlık' LIMIT 1) c,
  (VALUES
    ('727 Ada 1 Parsel'),
    ('727 Ada 2 Parsel'),
    ('724 Ada 16 Parsel'),
    ('2184 Ada 15 Parsel'),
    ('479 Ada 35 Parsel'),
    ('400 Ada 3 Parsel'),
    ('653 Ada 15 Parsel'),
    ('655 Ada 74 Parsel'),
    ('658 Ada 39 Parsel'),
    ('659 Ada 56 Parsel'),
    ('659 Ada 57 Parsel'),
    ('660 Ada 55 Parsel'),
    ('662 Ada 12 Parsel'),
    ('662 Ada 19 Parsel'),
    ('6 Ada 8 Parsel'),
    ('9 Ada 8 Parsel'),
    ('9 Ada 9 Parsel'),
    ('19 Ada 5-116 Parsel'),
    ('45 Ada 16 Parsel'),
    ('60 Ada 10 Parsel'),
    ('104 Ada 8 Parsel'),
    ('200 Ada 55 Parsel')
  ) AS project_list(project_name);
