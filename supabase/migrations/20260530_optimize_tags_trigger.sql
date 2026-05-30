-- =========================================================
-- TỐI ƯU HÓA: AUTOMATIC TAG COUNT SYNCHRONIZATION VIA TRIGGERS
-- =========================================================

-- 1. Hàm trigger tự động cập nhật số lượng sử dụng tags
CREATE OR REPLACE FUNCTION public.handle_resource_tags_change()
RETURNS TRIGGER AS $$
DECLARE
  tag_name text;
  removed_tags text[];
  added_tags text[];
BEGIN
  -- 1. Phân loại tags thêm mới và bị xóa đi
  IF TG_OP = 'INSERT' THEN
    added_tags := NEW.tags;
  ELSIF TG_OP = 'DELETE' THEN
    removed_tags := OLD.tags;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Lấy những tag có trong NEW mà không có trong OLD
    SELECT ARRAY(
      SELECT unnest(NEW.tags)
      EXCEPT
      SELECT unnest(OLD.tags)
    ) INTO added_tags;

    -- Lấy những tag có trong OLD mà không có trong NEW
    SELECT ARRAY(
      SELECT unnest(OLD.tags)
      EXCEPT
      SELECT unnest(NEW.tags)
    ) INTO removed_tags;
  END IF;

  -- 2. Xử lý các tag được thêm mới (Tăng bộ đếm hoặc thêm dòng mới)
  IF added_tags IS NOT NULL THEN
    FOREACH tag_name IN ARRAY added_tags LOOP
      IF tag_name IS NOT NULL AND tag_name != '' THEN
        INSERT INTO public.tags (name, usage_count)
        VALUES (lower(tag_name), 1)
        ON CONFLICT (name) 
        DO UPDATE SET usage_count = tags.usage_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- 3. Xử lý các tag bị xóa (Giảm bộ đếm và dọn dẹp nếu bằng 0)
  IF removed_tags IS NOT NULL THEN
    FOREACH tag_name IN ARRAY removed_tags LOOP
      IF tag_name IS NOT NULL AND tag_name != '' THEN
        UPDATE public.tags 
        SET usage_count = GREATEST(0, usage_count - 1)
        WHERE name = lower(tag_name);
      END IF;
    END LOOP;
    
    -- Xóa các tag không còn tài nguyên nào sử dụng
    DELETE FROM public.tags WHERE usage_count <= 0;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Gán trigger vào bảng resources
DROP TRIGGER IF EXISTS trg_resource_tags_change ON public.resources;
CREATE TRIGGER trg_resource_tags_change
AFTER INSERT OR UPDATE OR DELETE ON public.resources
FOR EACH ROW EXECUTE FUNCTION public.handle_resource_tags_change();

COMMENT ON FUNCTION public.handle_resource_tags_change() IS 'Tự động đồng bộ số lượng sử dụng tag trong bảng tags khi có thay đổi trong bảng resources.';
