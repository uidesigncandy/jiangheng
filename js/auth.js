/**
 * 江恒广告 - Supabase 登录鉴权
 * 依赖：js/supabase-config.js（需先配置 URL 和 anon key）
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * 未登录则跳转到登录页（用于首页、公文格式转换、文件调整对比等）
 */
export async function checkAuthRedirect() {
  const session = await getSession();
  if (!session) {
    const base = window.location.pathname.replace(/\/[^/]*$/, '') || '.';
    const loginUrl = base === '.' ? 'login.html' : base + '/login.html';
    window.location.replace(loginUrl);
    return false;
  }
  return true;
}

export { supabase };
