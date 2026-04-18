const cloud = require("wx-server-sdk");
const bcrypt = require("bcryptjs");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// 用户登录（手机号+密码）
const login = async (event) => {
  try {
    const { phone, password } = event;

    if (!phone) {
      return { success: false, error: '请输入手机号' };
    }

    if (!password) {
      return { success: false, error: '请输入密码' };
    }

    // 查询用户
    const userRes = await db.collection('users').where({ phone }).limit(1).get();

    if (userRes.data.length === 0) {
      return { success: false, error: '手机号未注册' };
    }

    const user = userRes.data[0];

    // 验证密码（使用 bcrypt）
    // 兼容两种情况：bcrypt 哈希密码和明文密码
    let passwordMatch = false;

    // 如果密码看起来像 bcrypt 哈希（以 $2a$ 或 $2b$ 开头）
    if (user.password && user.password.startsWith('$2')) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      // 兼容旧数据：明文比对
      passwordMatch = user.password === password;
    }

    if (!passwordMatch) {
      return { success: false, error: '密码错误' };
    }

    // 更新最后登录时间
    await db.collection('users').doc(user._id).update({
      data: { lastLoginTime: new Date() }
    });

    // 获取头像URL（优先使用云存储）
    let avatarUrl = user.avatarUrl || '';
    if (user.avatarFileID && user.avatarFileID.startsWith('cloud://')) {
      try {
        const tempUrlRes = await cloud.getTempFileURL({ fileList: [user.avatarFileID] });
        if (tempUrlRes.fileList && tempUrlRes.fileList[0] && tempUrlRes.fileList[0].tempFileURL) {
          avatarUrl = tempUrlRes.fileList[0].tempFileURL;
        }
      } catch (e) {
        console.error('获取头像临时URL失败:', e);
      }
    }

    return {
      success: true,
      data: {
        userId: user._id,
        phone: user.phone,
        nickName: user.nickName || '用户',
        avatarUrl: avatarUrl
      }
    };
  } catch (err) {
    return { success: false, error: err.message || '登录失败' };
  }
};

// 获取用户信息
const getUserInfo = async (event) => {
  try {
    const { userId } = event;

    if (!userId) {
      return { success: false, error: '缺少用户ID' };
    }

    const userRes = await db.collection('users').doc(userId).get();

    if (!userRes.data) {
      return { success: false, error: '用户不存在' };
    }

    const user = userRes.data;

    // 获取头像URL（优先使用云存储）
    let avatarUrl = user.avatarUrl || '';
    if (user.avatarFileID && user.avatarFileID.startsWith('cloud://')) {
      try {
        const tempUrlRes = await cloud.getTempFileURL({ fileList: [user.avatarFileID] });
        if (tempUrlRes.fileList && tempUrlRes.fileList[0] && tempUrlRes.fileList[0].tempFileURL) {
          avatarUrl = tempUrlRes.fileList[0].tempFileURL;
        }
      } catch (e) {
        console.error('获取头像临时URL失败:', e);
      }
    }

    return {
      success: true,
      data: {
        userId: user._id,
        phone: user.phone,
        nickName: user.nickName || '用户',
        avatarUrl: avatarUrl
      }
    };
  } catch (err) {
    return { success: false, error: err.message || '获取用户信息失败' };
  }
};

// 获取用户学习统计
const getUserStats = async (event) => {
  try {
    const { userId } = event;

    if (!userId) {
      return { success: false, error: '缺少用户ID' };
    }

    // 获取用户所有进度记录
    const progressRes = await db.collection('userProgress').where({ userId }).get();

    const progresses = progressRes.data;

    // 统计
    let finishedCount = 0;
    let favoriteCount = 0;
    let totalPlayCount = 0;
    let totalDuration = 0;

    progresses.forEach(p => {
      if (p.finished) finishedCount++;
      if (p.isFavorite) favoriteCount++;
      totalPlayCount += p.playCount || 0;
      totalDuration += p.lastPlayTime || 0;
    });

    // 获取收藏的章节详情
    const favoriteProgresses = progresses.filter(p => p.isFavorite);
    const favoriteChapterIds = favoriteProgresses.map(p => p.chapterId);

    let favoriteChapters = [];
    if (favoriteChapterIds.length > 0) {
      const chaptersRes = await db.collection('chapters')
        .where({ _id: db.command.in(favoriteChapterIds) })
        .get();

      // 获取对应的课程信息
      const courseIds = chaptersRes.data.map(ch => ch.course);
      const coursesRes = await db.collection('courses')
        .where({ _id: db.command.in(courseIds) })
        .get();

      const courseMap = {};
      coursesRes.data.forEach(c => {
        courseMap[c._id] = c;
      });

      favoriteChapters = chaptersRes.data.map(ch => {
        const progress = favoriteProgresses.find(p => p.chapterId === ch._id);
        const course = courseMap[ch.course] || {};
        return {
          ...ch,
          courseTitle: course.title || '',
          courseCover: course.cover || '',
          userProgress: progress
        };
      });
    }

    return {
      success: true,
      data: {
        finishedCount,
        favoriteCount,
        totalPlayCount,
        totalDuration,
        favoriteChapters
      }
    };
  } catch (err) {
    return { success: false, error: err.message || '获取统计失败' };
  }
};

// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "login":
      return await login(event);
    case "getUserInfo":
      return await getUserInfo(event);
    case "getUserStats":
      return await getUserStats(event);
    default:
      return { success: false, error: "未知的操作类型" };
  }
};