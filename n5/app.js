import {mountJlpt} from '../n4/app.js?v=shared-jlpt-2';

export function mountN5(options) {
 return mountJlpt({...options, level: 'N5'});
}
