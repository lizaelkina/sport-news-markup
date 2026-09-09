import {createBuild} from './gulp-tasks/index.mjs';
export {dev, dev as default} from './gulp-tasks/dev.mjs';

const tasks = createBuild();
export const {build, buildApache, views, styles, scripts, images, sprites, fonts, files, favicons, clean} = tasks;
