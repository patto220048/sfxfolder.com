-- =========================================================
-- TỐI ƯU HÓA: HÀM LẤY DANH SÁCH TAGS DUY NHẤT CHO CATEGORY & FOLDER
-- =========================================================

CREATE OR REPLACE FUNCTION get_unique_tags_for_category(p_category_id text, p_folder_ids uuid[] DEFAULT NULL)
RETURNS text[] AS $$
DECLARE
  v_tags text[];
BEGIN
  IF p_folder_ids IS NULL OR array_length(p_folder_ids, 1) IS NULL THEN
    SELECT COALESCE(array_agg(DISTINCT lower(tag) ORDER BY lower(tag)), '{}')
    INTO v_tags
    FROM (
      SELECT unnest(tags) AS tag
      FROM resources
      WHERE category_id = p_category_id AND is_published = true
    ) subquery
    WHERE tag IS NOT NULL AND tag != '';
  ELSE
    SELECT COALESCE(array_agg(DISTINCT lower(tag) ORDER BY lower(tag)), '{}')
    INTO v_tags
    FROM (
      SELECT unnest(tags) AS tag
      FROM resources
      WHERE category_id = p_category_id AND is_published = true AND folder_id = ANY(p_folder_ids)
    ) subquery
    WHERE tag IS NOT NULL AND tag != '';
  END IF;
  
  RETURN v_tags;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_unique_tags_for_category(text, uuid[]) IS 'Lấy danh sách các tags độc nhất và sắp xếp chữ cái cho một danh mục hoặc các thư mục chỉ định, tối ưu hóa băng thông.';
