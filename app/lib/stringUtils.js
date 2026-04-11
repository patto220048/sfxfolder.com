/**
 * Chuyển đổi chuỗi tiếng Việt có dấu thành không dấu
 * @param {string} str 
 * @returns {string}
 */
export const removeVietnameseTones = (str) => {
  if (!str) return "";
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  // Some system combine marks
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // ̀ ́ ̃ ̉ ̣  huyền, sắc, ngã, hỏi, nặng
  str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // ˆ ̆ ̛  Â, Ê, Ă, Ơ, Ư
  return str;
};

/**
 * Dọn dẹp tên file thành tên hiển thị Premium
 * @param {string} name 
 * @returns {string}
 */
export const cleanFileName = (name) => {
  if (!name) return "";
  
  // Xóa extension
  let baseName = name.replace(/\.[^/.]+$/, "");
  
  // Xóa các ký tự đặc biệt, giữ lại khoảng trắng
  baseName = baseName.replace(/[_-]/g, " ");
  
  // Tách từ và viết hoa chữ cái đầu (Title Case)
  return baseName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Tạo slug SEO từ text (hỗ trợ tiếng Việt)
 * @param {string} text 
 * @returns {string}
 */
export const convertToSlug = (text) => {
  if (!text) return "";
  
  let slug = removeVietnameseTones(text);
  
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Xóa ký tự đặc biệt trừ space và hyphen
    .replace(/\s+/g, "-")         // Thay space bằng hyphen
    .replace(/-+/g, "-")          // Xóa hyphen lặp lại
    .replace(/^-+|-+$/g, "");     // Xóa hyphen ở đầu/cuối
};
