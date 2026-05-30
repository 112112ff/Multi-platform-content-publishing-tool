import { bilibiliAdapter } from "./bilibili";
import { douyinAdapter } from "./douyin";
import { wechatAdapter } from "./wechat";
import { weiboAdapter } from "./weibo";
import { xiaohongshuAdapter } from "./xiaohongshu";
import { zhihuAdapter } from "./zhihu";

export const platformAdapters = [
  wechatAdapter,
  zhihuAdapter,
  bilibiliAdapter,
  xiaohongshuAdapter,
  weiboAdapter,
  douyinAdapter,
];

export const getPlatformAdapter = (platformId: string) =>
  platformAdapters.find((adapter) => adapter.id === platformId);
