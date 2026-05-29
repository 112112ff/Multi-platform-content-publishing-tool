import { platformProfiles } from "./profiles";
import { createStubAdapter } from "./stubAdapter";

export const platformAdapters = [
  createStubAdapter(platformProfiles.wechat),
  createStubAdapter(platformProfiles.zhihu),
  createStubAdapter(platformProfiles.bilibili),
  createStubAdapter(platformProfiles.xiaohongshu),
];

export const getPlatformAdapter = (platformId: string) =>
  platformAdapters.find((adapter) => adapter.id === platformId);
