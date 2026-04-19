/**
 * 听听课程管理后台服务
 * 处理前端请求并与微信云开发交互
 */

// 加载环境变量（从项目根目录）
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const musicMetadata = require('music-metadata');
const cloudbase = require('@cloudbase/node-sdk');
const tencentcloud = require('tencentcloud-sdk-nodejs');
const bcrypt = require('bcryptjs');
const CamClient = tencentcloud.cam.v20190116.Client;

// ========== 配置 ==========

let ENV_ID = process.env.TCB_ENV_ID || 'cloud1-2g5y53suf638dfb9';
let DEFAULT_SECRET_ID = process.env.TCB_SECRET_ID || '';
let DEFAULT_SECRET_KEY = process.env.TCB_SECRET_KEY || '';
const CLOUD_PATH_PREFIX = 'audio/';

// 本地头像存储路径
const AVATAR_LOCAL_PATH = path.join(__dirname, 'uploads', 'avatars');
const UPLOADS_PATH = path.join(__dirname, 'uploads');

// ========== 初始化 ==========

const app = express();

// 确保上传目录存在
if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}
if (!fs.existsSync(AVATAR_LOCAL_PATH)) {
  fs.mkdirSync(AVATAR_LOCAL_PATH, { recursive: true });
}

// 配置 multer 正确处理中文文件名（使用绝对路径）
const storage = multer.diskStorage({
  destination: UPLOADS_PATH,
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, Date.now() + '_' + originalName);
  }
});

const upload = multer({ storage: storage });

// 头像上传专用配置（保存到 avatars 目录）
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 确保目录存在
    if (!fs.existsSync(AVATAR_LOCAL_PATH)) {
      fs.mkdirSync(AVATAR_LOCAL_PATH, { recursive: true });
    }
    cb(null, AVATAR_LOCAL_PATH);
  },
  filename: (req, file, cb) => {
    // 使用用户ID + 时间戳作为文件名，确保每次上传都是新文件
    const userId = req.headers['x-upload-user-id'] || req.headers['x-user-id'] || 'unknown';
    const ext = path.extname(Buffer.from(file.originalname, 'latin1').toString('utf8'));
    const timestamp = Date.now();
    cb(null, `${userId}_${timestamp}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024  // 限制2MB
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片格式
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPG/PNG/WebP 格式的图片'));
    }
  }
});

// 中间件
app.use(express.json());

// 头像文件服务中间件（本地不存在时从云端下载）
app.use('/avatars', async (req, res, next) => {
  const filename = req.path.replace('/', '');  // 获取文件名
  const localPath = path.join(AVATAR_LOCAL_PATH, filename);

  // 本地文件存在，直接响应
  if (fs.existsSync(localPath)) {
    return next();
  }

  // 本地文件不存在，尝试从云端下载
  console.log('本地头像不存在，从云端下载:', filename);

  try {
    // 使用默认凭证初始化 tcb
    const tcb = cloudbase.init({
      env: ENV_ID,
      secretId: DEFAULT_SECRET_ID,
      secretKey: DEFAULT_SECRET_KEY
    });

    // 从文件名中提取 userId（格式：userId_timestamp.ext）
    const match = filename.match(/^([^_]+)_\d+\.(.+)$/);
    if (!match) {
      console.error('无法从文件名提取 userId:', filename);
      return res.status(404).send('头像不存在');
    }

    const userId = match[1];
    console.log('提取的 userId:', userId);

    // 从数据库查询用户的真实 avatarFileID
    const db = tcb.database();
    const userResult = await db.collection('users').doc(userId).get();
    const user = userResult.data[0];

    if (!user || !user.avatarFileID) {
      console.error('用户没有云端头像:', userId);
      return res.status(404).send('头像不存在');
    }

    const fileID = user.avatarFileID;
    console.log('数据库中的 avatarFileID:', fileID);

    // 获取临时下载链接
    const urlResult = await tcb.getTempFileURL({
      fileList: [fileID],
      maxAge: 3600
    });

    console.log('获取临时链接结果:', JSON.stringify(urlResult.fileList));

    if (urlResult.fileList && urlResult.fileList[0]?.tempFileURL && urlResult.fileList[0].code !== 'STORAGE_FILE_NONEXIST') {
      const tempUrl = urlResult.fileList[0].tempFileURL;
      console.log('临时链接获取成功:', tempUrl);

      // 下载文件
      const response = await fetch(tempUrl);
      console.log('下载响应状态:', response.status);

      if (response.ok) {
        const buffer = await response.arrayBuffer();

        // 确保目录存在
        if (!fs.existsSync(AVATAR_LOCAL_PATH)) {
          fs.mkdirSync(AVATAR_LOCAL_PATH, { recursive: true });
        }

        // 保存到本地
        fs.writeFileSync(localPath, Buffer.from(buffer));
        console.log('云端头像已下载到本地:', filename);

        // 继续响应静态文件
        return next();
      } else {
        console.error('下载失败:', response.status);
      }
    } else {
      console.error('获取临时链接失败:', JSON.stringify(urlResult.fileList));
    }
  } catch (e) {
    console.error('从云端下载头像失败:', e.message);
  }

  // 云端下载也失败，返回404
  res.status(404).send('头像不存在');
});

// 静态文件服务：头像目录
app.use('/avatars', express.static(AVATAR_LOCAL_PATH));

// 从请求头获取用户身份并初始化云开发（统一使用环境变量凭证）
function getTcbFromRequest(req) {
  // 检查用户是否已登录
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return null;  // 未登录
  }

  // 统一使用环境变量中的凭证
  if (!DEFAULT_SECRET_ID || !DEFAULT_SECRET_KEY) {
    console.error('环境变量未配置凭证');
    return null;
  }

  return cloudbase.init({
    env: ENV_ID,
    secretId: DEFAULT_SECRET_ID,
    secretKey: DEFAULT_SECRET_KEY
  });
}

// 响应封装
function success(data) {
  return { success: true, data };
}

function error(msg) {
  return { success: false, error: msg };
}

// ========== 认证 API ==========

// 连通测试（可接收新凭证进行测试）
app.post('/api/auth/test', async (req, res) => {
  try {
    // 如果请求体中有凭证，使用请求体凭证测试
    // 否则使用环境变量凭证
    let secretId, secretKey, envId;

    if (req.body.secretId && req.body.secretKey) {
      secretId = req.body.secretId;
      secretKey = req.body.secretKey;
      envId = req.body.envId || ENV_ID;
    } else {
      if (!DEFAULT_SECRET_ID || !DEFAULT_SECRET_KEY) {
        return res.json(error('系统未配置凭证，请检查环境变量'));
      }
      secretId = DEFAULT_SECRET_ID;
      secretKey = DEFAULT_SECRET_KEY;
      envId = ENV_ID;
    }

    const tcb = cloudbase.init({
      env: envId,
      secretId: secretId,
      secretKey: secretKey
    });

    const db = tcb.database();

    // 测试查询 users 集合总数
    const countResult = await db.collection('users').count();

    res.json(success({ connected: true, count: countResult.total }));
  } catch (err) {
    res.json(error(err.message || '连接失败'));
  }
});

// 手机号登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone) {
      return res.json(error('请输入手机号'));
    }

    if (!password) {
      return res.json(error('请输入密码'));
    }

    // 使用环境变量配置的凭证
    if (!DEFAULT_SECRET_ID || !DEFAULT_SECRET_KEY) {
      return res.json(error('系统未配置凭证，请检查环境变量'));
    }

    const tcb = cloudbase.init({
      env: ENV_ID,
      secretId: DEFAULT_SECRET_ID,
      secretKey: DEFAULT_SECRET_KEY
    });

    const db = tcb.database();

    // 查询用户
    const userResult = await db.collection('users').where({ phone }).limit(1).get();

    if (userResult.data.length === 0) {
      return res.json(error('手机号未注册'));
    }

    const user = userResult.data[0];

    // 验证密码（哈希比对）
    if (!user.password) {
      return res.json(error('用户未设置密码'));
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.json(error('密码错误'));
    }

    // 更新最后登录时间
    await db.collection('users').doc(user._id).update({
      lastLoginTime: new Date()
    });

    // 获取角色信息
    let roleName = '';
    let roleCode = '';
    let permissions = [];
    if (user.role) {
      const roleResult = await db.collection('roles').doc(user.role).get();
      if (roleResult.data.length > 0) {
        roleName = roleResult.data[0].name;
        roleCode = roleResult.data[0].code;
        permissions = roleResult.data[0].permissions || [];
      }
    }

    // 处理头像URL - 返回本地路径，如果本地不存在则从云端下载
    let avatarUrl = user.avatarUrl || '';
    let avatarFileID = user.avatarFileID || '';

    // 如果有云端 fileID 但本地文件不存在，尝试从云端下载
    if (avatarFileID && avatarUrl && avatarUrl.startsWith('/avatars/')) {
      const localPath = path.join(AVATAR_LOCAL_PATH, avatarUrl.replace('/avatars/', ''));
      if (!fs.existsSync(localPath)) {
        try {
          const urlResult = await tcb.getTempFileURL({ fileList: [avatarFileID] });
          if (urlResult.fileList && urlResult.fileList[0]?.tempFileURL) {
            const tempUrl = urlResult.fileList[0].tempFileURL;
            // 下载并保存到本地
            const response = await fetch(tempUrl);
            if (response.ok) {
              const buffer = await response.arrayBuffer();
              fs.writeFileSync(localPath, Buffer.from(buffer));
            }
          }
        } catch (e) {
          console.error('从云端下载头像失败:', e.message);
        }
      }
    }

    res.json(success({
      userId: user._id,
      phone: user.phone,
      nickName: user.nickName,
      avatarUrl: avatarUrl,
      avatarFileID: avatarFileID,
      roleName: roleName,
      roleCode: roleCode,
      permissions: permissions
    }));
  } catch (err) {
    res.json(error(err.message || '登录失败'));
  }
});

// 获取当前用户最新信息
app.get('/api/auth/current-user', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const userId = req.headers['x-user-id'];
    if (!userId) return res.json(error('缺少用户ID'));

    const db = tcb.database();

    // 查询用户
    const userResult = await db.collection('users').doc(userId).get();
    if (userResult.data.length === 0) {
      return res.json(error('用户不存在'));
    }

    const user = userResult.data[0];

    // 获取角色信息
    let roleName = '';
    let roleCode = '';
    let permissions = [];
    if (user.role) {
      const roleResult = await db.collection('roles').doc(user.role).get();
      if (roleResult.data.length > 0) {
        roleName = roleResult.data[0].name;
        roleCode = roleResult.data[0].code;
        permissions = roleResult.data[0].permissions || [];
      }
    }

    res.json(success({
      userId: user._id,
      phone: user.phone,
      nickName: user.nickName,
      avatarUrl: user.avatarUrl || '',
      avatarFileID: user.avatarFileID || '',
      roleName: roleName,
      roleCode: roleCode,
      permissions: permissions
    }));
  } catch (err) {
    res.json(error(err.message || '获取用户信息失败'));
  }
});

// 获取账号信息
app.get('/api/auth/account', async (req, res) => {
  try {
    if (!DEFAULT_SECRET_ID || !DEFAULT_SECRET_KEY) {
      return res.json(error('系统未配置凭证'));
    }

    // 创建CAM客户端
    const client = new CamClient({
      credential: {
        secretId: DEFAULT_SECRET_ID,
        secretKey: DEFAULT_SECRET_KEY
      },
      region: 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint: 'cam.tencentcloudapi.com'
        }
      }
    });

    // 获取用户AppId信息
    const appidResult = await client.GetUserAppId({});
    const ownerUin = String(appidResult.OwnerUin);  // 主账号ID
    const appId = appidResult.AppId;
    const apiUin = String(appidResult.Uin || ownerUin);

    let userName = '';
    let userType = '主账号';
    let currentUin = ownerUin;

    // 尝试GetAccountSummary获取账号概览（主账号名称）
    try {
      const summaryResult = await client.GetAccountSummary({});
      if (summaryResult.Uin === ownerUin) {
        // 主账号可能有别名
      }
    } catch (e) {
      // 忽略
    }

    // 尝试ListUsers获取子用户列表
    try {
      const listUsersResult = await client.ListUsers({});
      if (listUsersResult.Data && Array.isArray(listUsersResult.Data)) {
        // 检查当前API调用者是否在子用户列表中
        const matchingUser = listUsersResult.Data.find(u => String(u.Uin) === apiUin);
        if (matchingUser) {
          userName = matchingUser.Name || '';
          currentUin = String(matchingUser.Uin);
          userType = '子用户';
        }
      }
    } catch (e) {
      // 忽略
    }

    // 如果是主账号且没有获取到名字，尝试DescribeSubAccounts获取主账号信息
    if (userType === '主账号') {
      currentUin = ownerUin;
      try {
        const subAccountsResult = await client.DescribeSubAccounts({
          SubAccountUin: [parseInt(ownerUin)]
        });
        if (subAccountsResult.Data && subAccountsResult.Data.length > 0) {
          userName = subAccountsResult.Data[0].Name || '';
        }
      } catch (e) {
        // DescribeSubAccounts可能不适用于主账号
      }
    }

    res.json(success({
      userName: userName || '未知用户',
      userType: userType,
      appId: appId,
      ownerUin: ownerUin,
      currentUin: currentUin
    }));
  } catch (err) {
    res.json(error(err.message || '获取账号信息失败'));
  }
});

// ========== 批量更新序号 API ==========

// 批量更新序号
app.post('/api/batch-update-seq', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const { collection, updates } = req.body;

    if (!collection || !updates || !Array.isArray(updates)) {
      return res.json(error('参数错误'));
    }

    // 批量更新
    for (const item of updates) {
      await db.collection(collection).doc(item._id).update({
        seq: item.seq
      });
    }

    res.json(success({ updated: updates.length }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 课程 API ==========

// 获取课程列表
app.get('/api/courses', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();

    // 获取课程列表
    const coursesRes = await db.collection('courses').orderBy('seq', 'asc').get();

    // 获取分类列表
    const categoriesRes = await db.collection('categories').get();

    // 获取所有章节数量统计
    const chaptersRes = await db.collection('chapters').get();
    const chaptersCountMap = {};
    chaptersRes.data.forEach(chapter => {
      chaptersCountMap[chapter.course] = (chaptersCountMap[chapter.course] || 0) + 1;
    });

    // 构建分类映射
    const categoryMap = {};
    categoriesRes.data.forEach(cat => {
      categoryMap[cat._id] = cat.name;
    });

    // 关联分类名称和章节数
    const courses = coursesRes.data.map(course => ({
      ...course,
      categoryName: categoryMap[course.category] || '-',
      chapters: chaptersCountMap[course._id] || 0
    }));

    res.json(success(courses));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 创建课程
app.post('/api/courses', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const data = req.body;

    const result = await db.collection('courses').add({
      seq: data.seq || 1,
      title: data.title,
      author: data.author,
      category: data.category,
      cover: data.cover,
      description: data.description,
      onlineTime: data.onlineTime || '',
      status: data.status || 'published'
    });

    res.json(success({ id: result.id }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新课程
app.put('/api/courses/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;
    const data = req.body;

    await db.collection('courses').doc(id).update({
      seq: data.seq,
      title: data.title,
      author: data.author,
      category: data.category,
      cover: data.cover,
      description: data.description,
      onlineTime: data.onlineTime || '',
      status: data.status
    });

    res.json(success({ updated: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除课程
app.delete('/api/courses/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    // 删除关联的章节
    await db.collection('chapters').where({ course: id }).remove();

    // 删除课程
    await db.collection('courses').doc(id).remove();

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 章节 API ==========

// 获取章节列表
app.get('/api/chapters', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const courseId = req.query.courseId;

    let query = db.collection('chapters');
    if (courseId) {
      query = query.where({ course: courseId });
    }

    const result = await query.orderBy('seq', 'asc').get();

    // 为旧数据添加 finished 字段（默认 false）
    const chapters = result.data.map(ch => ({
      ...ch,
      finished: ch.finished !== undefined ? ch.finished : false
    }));

    res.json(success(chapters));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 创建章节
app.post('/api/chapters', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const data = req.body;

    const result = await db.collection('chapters').add({
      course: data.course,
      seq: data.seq || 1,
      title: data.title,
      audioUrl: data.audioUrl || '',
      audioFileSize: data.audioFileSize || 0,
      duration: data.duration || 0,
      lastPlayTime: data.lastPlayTime || 0,
      playCount: data.playCount || 0,
      favorite: data.favorite || false,
      finished: data.finished || false
    });

    res.json(success({ id: result.id }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新章节
app.put('/api/chapters/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;
    const data = req.body;

    console.log('更新章节 ID:', id);
    console.log('更新数据:', JSON.stringify(data));

    // 判断是完整编辑还是只更新 finished（完播/重置按钮）
    if (data.finished !== undefined && data.seq === undefined) {
      // 先获取当前播放量和时长
      const chapterRes = await db.collection('chapters').doc(id).get();
      const chapterData = chapterRes.data[0];
      const currentPlayCount = Number(chapterData.playCount) || 0;
      const duration = Number(chapterData.duration) || 0;

      // 重置时（finished=false），清空上次播放时间
      if (data.finished === false) {
        await db.collection('chapters').doc(id).update({
          finished: false,
          lastPlayTime: 0
        });
      } else {
        // 完播时，播放量+1，上次播放=时长
        await db.collection('chapters').doc(id).update({
          finished: true,
          playCount: currentPlayCount + 1,
          lastPlayTime: duration
        });
      }
    } else {
      // 完整编辑
      // 先获取当前数据，判断是否需要自动完播
      const chapterRes = await db.collection('chapters').doc(id).get();
      const chapter = chapterRes.data;
      const currentFinished = chapter.finished === true;
      const currentPlayCount = Number(chapter.playCount) || 0;

      const lastPlayTime = data.lastPlayTime ?? 0;
      const duration = data.duration ?? 0;

      const updateData = {
        seq: data.seq,
        title: data.title,
        audioUrl: data.audioUrl || '',
        audioFileSize: data.audioFileSize || 0,
        duration: duration,
        lastPlayTime: lastPlayTime,
        playCount: data.playCount ?? 0,
        favorite: data.favorite ?? false
      };

      // 自动完播规则：
      // 上次播放 >= 时长 > 0 → 自动完播，播放量+1（基于用户输入的值）
      console.log('自动完播检查:', { duration, lastPlayTime, currentFinished, inputPlayCount: data.playCount });
      if (duration > 0 && lastPlayTime >= duration) {
        const newPlayCount = Number(data.playCount) + 1;
        console.log('触发完播逻辑, playCount:', data.playCount, '+1 =', newPlayCount);
        updateData.finished = true;
        updateData.playCount = newPlayCount;
      }

      console.log('实际更新字段:', JSON.stringify(updateData));
      const updateResult = await db.collection('chapters').doc(id).update(updateData);
      console.log('数据库更新结果:', JSON.stringify(updateResult));
    }

    res.json(success({ updated: true }));
  } catch (err) {
    console.error('更新章节失败:', err.message);
    res.json(error(err.message));
  }
});

// 删除章节
app.delete('/api/chapters/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    // 先获取章节信息，检查是否有音频
    const chapter = await db.collection('chapters').doc(id).get();
    const chapterData = chapter.data[0];

    // 如果有音频，删除云存储文件和 audios 记录
    if (chapterData && chapterData.audioUrl) {
      try {
        await tcb.deleteFile({ fileList: [chapterData.audioUrl] });
        console.log('已删除音频文件:', chapterData.audioUrl);
      } catch (e) {
        console.error('删除云存储文件失败:', e);
        // 继续删除章节，不中断流程
      }

      // 删除 audios 表中对应的记录
      const audios = await db.collection('audios').where({ audioFile: chapterData.audioUrl }).get();
      if (audios.data.length > 0) {
        for (const audio of audios.data) {
          await db.collection('audios').doc(audio._id).remove();
          console.log('已删除 audios 记录:', audio._id);
        }
      }
    }

    // 删除章节记录
    await db.collection('chapters').doc(id).remove();

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除章节的音频文件
app.delete('/api/chapters/:id/audio', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    // 获取章节信息
    const chapter = await db.collection('chapters').doc(id).get();
    const chapterData = chapter.data[0];

    if (chapterData && chapterData.audioUrl) {
      // 删除云存储文件
      try {
        await tcb.deleteFile({ fileList: [chapterData.audioUrl] });
      } catch (e) {
        console.error('删除云存储文件失败:', e);
      }

      // 更新章节，清除音频信息
      await db.collection('chapters').doc(id).update({
        audioUrl: '',
        audioFileSize: 0
      });

      // 同时删除 audios 集合中的关联记录（如果有）
      const audios = await db.collection('audios').where({ audioFile: chapterData.audioUrl }).get();
      if (audios.data.length > 0) {
        for (const audio of audios.data) {
          await db.collection('audios').doc(audio._id).remove();
        }
      }
    }

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 音频 API ==========

// 获取音频列表
app.get('/api/audios', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const result = await db.collection('audios').orderBy('_createTime', 'asc').get();

    res.json(success(result.data));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 上传音频
app.post('/api/audios/upload', upload.single('audio'), async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const file = req.file;

    if (!file) return res.json(error('请选择音频文件'));

    // 获取上传表单参数
    const courseId = req.body.courseId || '';
    const seq = parseInt(req.body.seq) || 0;
    const title = req.body.title || '';

    // 获取音频元数据
    const metadata = await musicMetadata.parseFile(file.path);
    const duration = Math.round(metadata.format.duration || 0);
    const fileSize = file.size;

    // 原始文件名（修复编码）
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const cloudPath = `${CLOUD_PATH_PREFIX}${Date.now()}_${originalName}`;

    // 上传到云存储
    const fileContent = fs.readFileSync(file.path);
    const uploadResult = await tcb.uploadFile({
      cloudPath: cloudPath,
      fileContent: fileContent
    });

    // 删除临时文件
    fs.unlinkSync(file.path);

    if (!uploadResult.fileID) {
      return res.json(error('云存储上传失败'));
    }

    // 使用表单提供的标题，否则使用文件名
    const audioTitle = title || originalName.replace(/\.(mp3|m4a|wav|ogg|flac|aac)$/, '');

    // 写入 audios 集合
    const audioResult = await db.collection('audios').add({
      title: audioTitle,
      course: courseId,
      seq: seq,
      audioFile: uploadResult.fileID,
      duration: duration,
      fileSize: fileSize,
      createTime: new Date(),
      _createTime: new Date()
    });

    // 返回音频信息
    res.json(success({
      audioId: audioResult.id,
      fileID: uploadResult.fileID,
      duration: duration,
      fileSize: fileSize,
      fileName: originalName
    }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除音频
app.delete('/api/audios/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    // 获取音频信息
    const audio = await db.collection('audios').doc(id).get();
    const audioData = audio.data[0];

    if (audioData && audioData.audioFile) {
      // 删除云存储文件
      await tcb.deleteFile({ fileList: [audioData.audioFile] });

      // 清除关联章节的 audioUrl（而不是删除章节）
      const chapters = await db.collection('chapters').where({ audioUrl: audioData.audioFile }).get();
      if (chapters.data.length > 0) {
        for (const chapter of chapters.data) {
          await db.collection('chapters').doc(chapter._id).update({
            audioUrl: '',
            audioFileSize: 0
          });
        }
      }
    }

    // 删除 audios 记录
    await db.collection('audios').doc(id).remove();

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 头条 API ==========

// 获取头条列表
app.get('/api/headlines', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const result = await db.collection('headlines').orderBy('seq', 'asc').get();

    res.json(success(result.data));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 创建头条
app.post('/api/headlines', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const data = req.body;

    const result = await db.collection('headlines').add({
      seq: data.seq || 1,
      title: data.title,
      image: data.image || '',
      link: data.link || '',
      _createTime: new Date()
    });

    res.json(success({ _id: result.id }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新头条
app.put('/api/headlines/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;
    const data = req.body;

    await db.collection('headlines').doc(id).update({
      seq: data.seq,
      title: data.title,
      image: data.image || '',
      link: data.link || ''
    });

    res.json(success({ updated: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除头条
app.delete('/api/headlines/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    await db.collection('headlines').doc(id).remove();

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 获取轮播配置
app.get('/api/banner-config', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const result = await db.collection('config').where({ key: 'banner' }).limit(1).get();

    if (result.data.length > 0) {
      const value = result.data[0].value || {};
      res.json(success({
        speed: value.speed || 3,
        homeProtect: value.homeProtect !== false
      }));
    } else {
      res.json(success({ speed: 3, homeProtect: true }));
    }
  } catch (err) {
    res.json(error(err.message));
  }
});

// 保存轮播配置
app.post('/api/banner-config', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const { speed, homeProtect } = req.body;

    // 查询是否已有配置
    const existing = await db.collection('config').where({ key: 'banner' }).limit(1).get();

    const configValue = {
      speed: speed || 3,
      homeProtect: homeProtect !== false
    };

    if (existing.data.length > 0) {
      await db.collection('config').doc(existing.data[0]._id).update({
        value: configValue
      });
    } else {
      await db.collection('config').add({
        key: 'banner',
        value: configValue
      });
    }

    res.json(success({ saved: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 分类 API ==========

// 获取分类列表
app.get('/api/categories', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const result = await db.collection('categories').orderBy('seq', 'asc').get();

    res.json(success(result.data));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 创建分类
app.post('/api/categories', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const data = req.body;

    const result = await db.collection('categories').add({
      seq: data.seq || 1,
      name: data.name,
      description: data.description || ''
    });

    res.json(success({ id: result.id }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新分类
app.put('/api/categories/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;
    const data = req.body;

    await db.collection('categories').doc(id).update({
      seq: data.seq,
      name: data.name,
      description: data.description
    });

    res.json(success({ updated: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除分类
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    await db.collection('categories').doc(id).remove();

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 用户 API ==========

// 上传头像（云端 + 本地同步）
app.post('/api/users/avatar', (req, res, next) => {
  console.log('=== 收到头像上传请求 ===');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('X-Upload-User-Id:', req.headers['x-upload-user-id']);
  console.log('X-User-Id:', req.headers['x-user-id']);
  next();
}, avatarUpload.single('avatar'), async (req, res) => {
  try {
    console.log('=== multer 处理完成 ===');
    console.log('req.file:', req.file ? { path: req.file.path, filename: req.file.filename, size: req.file.size } : null);

    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const file = req.file;
    // 优先使用 X-Upload-User-Id（被编辑用户），其次使用 X-User-Id（当前登录用户）
    const userId = req.headers['x-upload-user-id'] || req.headers['x-user-id'];
    if (!file) return res.json(error('请选择图片文件'));
    if (!userId) return res.json(error('缺少用户ID'));

    // 检查文件是否存在
    if (!fs.existsSync(file.path)) {
      console.error('文件不存在:', file.path);
      return res.json(error('文件保存失败'));
    }

    // 先上传到云存储（使用新文件名）
    const cloudPath = `avatars/${file.filename}`;
    const fileContent = fs.readFileSync(file.path);

    console.log('开始上传云端:', cloudPath);
    const uploadResult = await tcb.uploadFile({
      cloudPath: cloudPath,
      fileContent: fileContent
    });

    console.log('云端上传结果:', uploadResult.fileID ? '成功' : '失败');

    if (!uploadResult.fileID) {
      // 云端上传失败，删除本地文件
      fs.unlinkSync(file.path);
      return res.json(error('云存储上传失败'));
    }

    // 云端上传成功后，再删除旧头像（云端 + 本地）
    const db = tcb.database();
    const userResult = await db.collection('users').doc(userId).get();
    const oldUser = userResult.data[0];

    if (oldUser && oldUser.avatarFileID && oldUser.avatarFileID !== uploadResult.fileID) {
      // 删除云端旧文件
      try {
        console.log('删除云端旧头像:', oldUser.avatarFileID);
        await tcb.deleteFile({ fileList: [oldUser.avatarFileID] });
      } catch (e) {
        console.error('删除云端旧头像失败:', e.message);
      }
    }

    // 删除本地旧文件（查找以 userId_ 开头的所有文件，排除新上传的）
    try {
      const localFiles = fs.readdirSync(AVATAR_LOCAL_PATH);
      localFiles.forEach(f => {
        // 匹配 userId_开头的文件，且不是刚上传的新文件
        if (f.startsWith(userId + '_') && f !== file.filename) {
          const oldPath = path.join(AVATAR_LOCAL_PATH, f);
          try {
            console.log('删除本地旧头像:', oldPath);
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.error('删除本地旧头像失败:', e.message);
          }
        }
      });
    } catch (e) {
      console.error('读取本地头像目录失败:', e.message);
    }

    // 返回本地路径和云端 fileID
    const localUrl = `/avatars/${file.filename}`;
    console.log('上传成功，返回:', localUrl);
    res.json(success({
      localUrl: localUrl,
      fileID: uploadResult.fileID
    }));
  } catch (err) {
    console.error('上传头像出错:', err.message);
    // 只在出错时清理本地文件（云端上传失败时文件已被删除）
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.json(error(err.message));
  }
});

// 获取用户列表
app.get('/api/users', async (req, res) => {
  try {
    const currentUserId = req.headers['x-user-id'];
    const currentRoleCode = req.headers['x-role-code'];

    if (!DEFAULT_SECRET_ID || !DEFAULT_SECRET_KEY) {
      return res.json(error('系统未配置凭证'));
    }

    const tcb = cloudbase.init({
      env: ENV_ID,
      secretId: DEFAULT_SECRET_ID,
      secretKey: DEFAULT_SECRET_KEY
    });

    const db = tcb.database();

    // 根据角色决定查询范围
    let query = db.collection('users');

    // 非管理员只能看到自己
    if (currentRoleCode !== 'admin' && currentUserId) {
      query = query.where({ _id: currentUserId });
    }

    const result = await query.orderBy('seq', 'asc').get();

    const users = result.data;

    // 不再处理临时链接，让前端自己处理
    // 返回原始avatarUrl（cloud://格式），前端会动态获取临时链接

    res.json(success(users));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 获取云存储文件临时链接
app.post('/api/file/temp-url', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const { fileID } = req.body;
    if (!fileID || !fileID.startsWith('cloud://')) {
      return res.json(error('无效的文件ID'));
    }

    const urlResult = await tcb.getTempFileURL({
      fileList: [fileID],
      maxAge: 7 * 24 * 60 * 60  // 7天有效期
    });

    if (urlResult.fileList && urlResult.fileList[0]?.tempFileURL) {
      res.json(success({ tempFileURL: urlResult.fileList[0].tempFileURL }));
    } else {
      res.json(error('获取临时链接失败'));
    }
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 用户进度 API ==========

// 获取用户进度
app.get('/api/user-progress', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const { userId, courseId } = req.query;
    console.log('获取用户进度请求:', { userId, courseId });
    if (!userId) return res.json(error('缺少用户ID'));

    const db = tcb.database();

    // 只按 userId 查询，不做 courseId 筛选
    const result = await db.collection('userProgress').where({ userId }).get();
    console.log('查询进度结果条数:', result.data?.length);
    console.log('查询进度结果详情:', JSON.stringify(result.data, null, 2));
    res.json(success(result.data));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新用户进度
app.put('/api/user-progress', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const { userId, chapterId, lastPlayTime, finished, isFavorite, playCount } = req.body;
    console.log('更新用户进度请求:', { userId, chapterId, lastPlayTime, finished, playCount });
    if (!userId || !chapterId) return res.json(error('缺少参数'));

    const db = tcb.database();

    // 获取章节信息（用于判断完播）
    const chapterRes = await db.collection('chapters').doc(chapterId).get();
    // doc查询可能返回数组或对象，统一处理
    const chapter = Array.isArray(chapterRes.data) ? chapterRes.data[0] : chapterRes.data;
    console.log('完整章节信息:', chapter);
    const duration = Number(chapter?.duration) || 0;
    const chapterTotalPlayCount = Number(chapter?.playCount) || 0;
    console.log('章节信息:', { duration, chapterTotalPlayCount });

    // 查询现有记录 - 尝试多种查询方式确保能找到记录
    let existing = null;

    // 方式1: 直接按 userId + chapterId 查询
    const query1 = await db.collection('userProgress')
      .where({ userId, chapterId })
      .limit(1)
      .get();
    console.log('查询方式1 (userId+chapterId):', query1.data?.length);

    if (query1.data?.length > 0) {
      existing = query1.data[0];
    } else {
      // 方式2: 只按 userId 查询，再过滤 chapterId
      const query2 = await db.collection('userProgress').where({ userId }).get();
      console.log('查询方式2 (只userId):', query2.data?.length);
      console.log('查询方式2详情:', JSON.stringify(query2.data, null, 2));

      // 手动过滤
      const matched = query2.data?.find(r =>
        r.chapterId === chapterId ||
        r.chapter_id === chapterId ||
        r._id === chapterId
      );
      if (matched) {
        existing = matched;
        console.log('方式2找到匹配记录:', matched);
      }
    }

    console.log('最终找到的现有记录:', existing);
    const currentFinished = existing?.finished || false;
    const currentPlayCount = existing?.playCount || 0;
    console.log('现有进度:', { currentFinished, currentPlayCount });

    const updateData = {};

    // 自动完播判断：播放时长 > 时长 - 10秒，且未完播，自动设置 finished=true，playCount+1
    let shouldAutoFinish = false;
    if (lastPlayTime !== undefined && finished !== true) {
      shouldAutoFinish = !currentFinished && duration > 0 && lastPlayTime > duration - 10;
    }
    console.log('自动完播判断:', {
      lastPlayTime,
      duration,
      threshold: duration - 10,
      currentFinished,
      shouldAutoFinish
    });

    if (lastPlayTime !== undefined) updateData.lastPlayTime = lastPlayTime;

    // 处理完播状态
    if (finished === true) {
      // 手动设置为完播
      updateData.finished = true;
    } else if (shouldAutoFinish) {
      // 自动完播
      updateData.finished = true;
      updateData.playCount = currentPlayCount + 1;
    } else if (finished === false) {
      updateData.finished = false;
    }

    if (isFavorite !== undefined) updateData.isFavorite = isFavorite;
    if (playCount !== undefined && !shouldAutoFinish) updateData.playCount = playCount;

    // 更新或创建用户进度记录
    console.log('准备更新的数据:', updateData);
    if (existing) {
      // 如果旧记录没有 courseId 或 duration，补充上
      if (!existing.courseId && chapter?.course) {
        updateData.courseId = chapter.course;
      }
      if (!existing.duration && duration > 0) {
        updateData.duration = duration;
      }
      // TCB update 需要使用 { data: ... } 格式
      const updateResult = await db.collection('userProgress').doc(existing._id).update(updateData);
      console.log('用户进度更新结果:', updateResult);
    } else {
      console.log('准备新增用户进度记录, courseId:', chapter?.course);
      const addResult = await db.collection('userProgress').add({
        userId,
        chapterId,
        courseId: chapter?.course,
        duration,  // 添加时长字段
        lastPlayTime: lastPlayTime || 0,
        finished: finished || shouldAutoFinish,
        isFavorite: isFavorite || false,
        playCount: (finished || shouldAutoFinish) ? 1 : (playCount || 0)
      });
      console.log('用户进度添加结果:', addResult);
    }

    // 如果触发自动完播，更新章节总播放量
    if (shouldAutoFinish) {
      const chapterUpdateResult = await db.collection('chapters').doc(chapterId).update({
        data: { playCount: chapterTotalPlayCount + 1 }
      });
      console.log('章节播放量更新结果:', chapterUpdateResult);
    }

    // 如果是收藏操作，更新章节的 favoriteCount
    if (isFavorite !== undefined && existing) {
      const oldIsFavorite = existing.isFavorite || false;
      if (oldIsFavorite !== isFavorite) {
        const oldCount = chapter?.favoriteCount || 0;
        const newCount = isFavorite ? oldCount + 1 : Math.max(0, oldCount - 1);
        await db.collection('chapters').doc(chapterId).update({ data: { favoriteCount: newCount } });
      }
    }

    res.json(success());
  } catch (err) {
    res.json(error(err.message));
  }
});

// 创建用户
app.post('/api/users', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const data = req.body;

    // 自动计算序号：获取最大序号 + 1
    const result = await db.collection('users').orderBy('seq', 'desc').limit(1).get();
    const maxSeq = result.data.length > 0 ? result.data[0].seq : 0;
    const newSeq = maxSeq + 1;

    // 昵称为空时自动生成
    let nickName = data.nickName;
    if (!nickName && data.phone) {
      nickName = '用户' + data.phone.slice(-4);
    }

    // 角色为空时自动为普通用户
    let role = data.role;
    if (!role) {
      const rolesRes = await db.collection('roles').where({ code: 'user' }).get();
      if (rolesRes.data.length > 0) {
        role = rolesRes.data[0]._id;
      }
    }

    // 对密码进行哈希处理，默认密码为 '1'
    const plainPassword = data.password || '1';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const userResult = await db.collection('users').add({
      seq: newSeq,
      nickName: nickName,
      avatarUrl: data.avatarUrl || '',
      avatarFileID: data.avatarFileID || '',
      phone: data.phone,
      password: hashedPassword,
      role: role,
      createTime: new Date()
    });

    res.json(success({ id: userResult.id }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新用户
app.put('/api/users/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;
    const data = req.body;

    const updateData = {
      seq: data.seq,
      nickName: data.nickName,
      avatarUrl: data.avatarUrl,
      avatarFileID: data.avatarFileID,
      phone: data.phone,
      role: data.role
    };

    // 更新密码（只有传了密码才更新，需要哈希处理）
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    // 只有管理员可以修改最后登录时间
    if (data.lastLoginTime) {
      updateData.lastLoginTime = data.lastLoginTime;
    }

    await db.collection('users').doc(id).update(updateData);

    res.json(success({ updated: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除用户
app.delete('/api/users/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    // 先获取用户信息，删除头像文件（云端 + 本地）
    const user = await db.collection('users').doc(id).get();
    const userData = user.data[0];

    if (userData) {
      // 删除云端头像
      if (userData.avatarFileID) {
        try {
          await tcb.deleteFile({ fileList: [userData.avatarFileID] });
        } catch (e) {
          console.error('删除云端头像失败:', e.message);
        }
      }

      // 删除本地头像（可能存在不同扩展名）
      const localBase = path.join(AVATAR_LOCAL_PATH, id);
      ['.jpg', '.jpeg', '.png', '.webp'].forEach(ext => {
        const localPath = localBase + ext;
        if (fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath);
          } catch (e) {
            console.error('删除本地头像失败:', e.message);
          }
        }
      });
    }

    // 删除用户
    await db.collection('users').doc(id).remove();

    // 获取剩余用户并重新排列序号
    const remainingUsers = await db.collection('users').orderBy('seq', 'asc').get();
    for (let i = 0; i < remainingUsers.data.length; i++) {
      const u = remainingUsers.data[i];
      if (u.seq !== i + 1) {
        await db.collection('users').doc(u._id).update({
          seq: i + 1
        });
      }
    }

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 角色 API ==========

// 获取角色列表
app.get('/api/roles', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const result = await db.collection('roles').orderBy('seq', 'asc').get();

    res.json(success(result.data));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 创建角色
app.post('/api/roles', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const data = req.body;

    const result = await db.collection('roles').add({
      seq: data.seq || 1,
      name: data.name,
      code: data.code,
      description: data.description || '',
      permissions: data.permissions || []
    });

    res.json(success({ id: result.id }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 更新角色
app.put('/api/roles/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;
    const data = req.body;

    await db.collection('roles').doc(id).update({
      seq: data.seq,
      name: data.name,
      code: data.code,
      description: data.description,
      permissions: data.permissions
    });

    res.json(success({ updated: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 删除角色
app.delete('/api/roles/:id', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const id = req.params.id;

    // 检查是否有用户使用此角色
    const usersWithRole = await db.collection('users').where({ role: id }).count();
    if (usersWithRole.total > 0) {
      return res.json(error(`有 ${usersWithRole.total} 个用户使用此角色，无法删除`));
    }

    await db.collection('roles').doc(id).remove();

    res.json(success({ deleted: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 菜单配置 API ==========

// 获取菜单配置
app.get('/api/menu-config', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();

    // 尝试查询，如果集合不存在则返回默认配置
    try {
      const result = await db.collection('config').where({ key: 'menuOrder' }).limit(1).get();
      if (result.data.length > 0) {
        res.json(success({ menuOrder: result.data[0].value }));
      } else {
        const defaultOrder = ['courses', 'audios', 'headlines', 'categories', 'users', 'roles', 'system'];
        res.json(success({ menuOrder: defaultOrder }));
      }
    } catch (e) {
      // 集合不存在，返回默认配置
      if (e.message && e.message.includes('not exist')) {
        const defaultOrder = ['courses', 'audios', 'headlines', 'categories', 'users', 'roles', 'system'];
        res.json(success({ menuOrder: defaultOrder }));
      } else {
        throw e;
      }
    }
  } catch (err) {
    res.json(error(err.message));
  }
});

// 保存菜单配置
app.post('/api/menu-config', async (req, res) => {
  try {
    const tcb = getTcbFromRequest(req);
    if (!tcb) return res.json(error('未登录'));

    const db = tcb.database();
    const { menuOrder } = req.body;

    if (!menuOrder || !Array.isArray(menuOrder)) {
      return res.json(error('菜单顺序数据无效'));
    }

    // 尝试查询是否已有配置
    let existing = null;
    try {
      const result = await db.collection('config').where({ key: 'menuOrder' }).limit(1).get();
      existing = result.data.length > 0 ? result.data[0] : null;
    } catch (e) {
      // 集合不存在，尝试创建集合
      if (e.message && e.message.includes('not exist')) {
        console.log('config集合不存在，尝试创建...');
        try {
          await db.createCollection('config');
          console.log('config集合创建成功');
        } catch (createErr) {
          console.log('创建集合失败:', createErr.message);
        }
      }
    }

    if (existing) {
      // 更新现有配置
      await db.collection('config').doc(existing._id).update({
        value: menuOrder,
        updateTime: new Date()
      });
    } else {
      // 创建新配置
      await db.collection('config').add({
        key: 'menuOrder',
        value: menuOrder,
        createTime: new Date()
      });
    }

    res.json(success({ saved: true }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 环境配置 API ==========

// 获取环境配置（允许未登录访问，用于登录页面配置）
app.get('/api/env-config', async (req, res) => {
  try {
    res.json(success({
      envId: ENV_ID,
      secretId: DEFAULT_SECRET_ID,
      secretKey: DEFAULT_SECRET_KEY
    }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// 保存环境配置（允许未登录访问，用于登录页面配置）
app.post('/api/env-config', async (req, res) => {
  try {
    const { envId, secretId, secretKey } = req.body;

    if (!envId || !secretId || !secretKey) {
      return res.json(error('请填写完整配置'));
    }

    // 构建 .env 文件内容
    const envContent = `# 腾讯云/微信云开发凭证
# 请填写你的真实凭证，此文件不会被提交到 git

# 前端使用（VITE_前缀）
VITE_TCB_SECRET_ID=${secretId}
VITE_TCB_SECRET_KEY=${secretKey}
VITE_TCB_ENV_ID=${envId}

# 后端使用（无前缀）
TCB_SECRET_ID=${secretId}
TCB_SECRET_KEY=${secretKey}
TCB_ENV_ID=${envId}

# 后端服务端口
SERVER_PORT=3002
`;

    // 写入 .env 文件
    const envPath = path.join(__dirname, '../../.env');
    fs.writeFileSync(envPath, envContent, 'utf8');

    // 更新当前进程的环境变量
    process.env.TCB_ENV_ID = envId;
    process.env.TCB_SECRET_ID = secretId;
    process.env.TCB_SECRET_KEY = secretKey;

    // 更新全局变量
    ENV_ID = envId;
    DEFAULT_SECRET_ID = secretId;
    DEFAULT_SECRET_KEY = secretKey;

    res.json(success({
      saved: true,
      message: '配置已保存，重启后端服务后生效'
    }));
  } catch (err) {
    res.json(error(err.message));
  }
});

// ========== 启动服务器 ==========

const PORT = process.env.SERVER_PORT || 3002;
app.listen(PORT, () => {
  console.log(`后台服务已启动: http://localhost:${PORT}`);
  console.log('请确保前端服务也在运行 (npm run dev)');
});