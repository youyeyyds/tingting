const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// 获取openid
const getOpenId = async () => {
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取分类列表
const getCategories = async () => {
  try {
    const res = await db.collection("categories")
      .orderBy("seq", "asc")
      .get();
    return {
      success: true,
      data: res.data
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 查询课程列表（关联分类）
const getCourses = async (event) => {
  try {
    const { limit = 20 } = event;

    // 获取课程列表
    const coursesRes = await db.collection("courses")
      .orderBy("seq", "asc")
      .limit(limit)
      .get();

    // 获取分类列表
    const categoriesRes = await db.collection("categories")
      .get();

    // 构建分类映射 { _id: name }
    const categoryMap = {};
    categoriesRes.data.forEach(cat => {
      categoryMap[cat._id] = cat.name;
    });

    // 关联分类名称到课程（course.category 存的是分类ID）
    const courses = coursesRes.data.map(course => ({
      ...course,
      categoryName: categoryMap[course.category] || course.category
    }));

    return {
      success: true,
      data: courses
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || e
    };
  }
};

// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getCategories":
      return await getCategories();
    case "getCourses":
      return await getCourses(event);
    default:
      return { success: false, errMsg: "未知的操作类型" };
  }
};