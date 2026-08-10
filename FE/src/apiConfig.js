export const getApiUrl = (path = '') => {
  const host = window.location.hostname || 'localhost';
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const port = protocol === 'https:' ? '7248' : '5248';
  const p = path || '';
  const cleanPath = p ? (p.startsWith('/') ? p : `/${p}`) : '';
  return `${protocol}//${host}:${port}${cleanPath}`;
};

export const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('/')) {
    return getApiUrl(url);
  }
  if (url.includes('/uploads/')) {
    const uploadPath = url.substring(url.indexOf('/uploads/'));
    return getApiUrl(uploadPath);
  }
  return url;
};
