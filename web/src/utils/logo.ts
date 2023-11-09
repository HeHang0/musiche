const routerHistory = localStorage.getItem('musiche-router-prefix');
const imagePrefix = routerHistory ? '/' + routerHistory : '';
export const LogoImage = imagePrefix + '/logo.png';
export const LogoCircleImage = imagePrefix + '/logo-circle.png';
