import { bilibiliAdapter } from "./bilibili";
import { wechatAdapter } from "./wechat";
import { xiaohongshuAdapter } from "./xiaohongshu";
import { zhihuAdapter } from "./zhihu";

export const platformAdapters = [
  wechatAdapter,
  zhihuAdapter,
  bilibiliAdapter,
  xiaohongshuAdapter,
];

export const getPlatformAdapter = (platformId: string) =>
  platformAdapters.find((adapter) => adapter.id === platformId);
