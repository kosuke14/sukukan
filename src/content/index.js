import { defineLessons, allLessons, lessonsBySubject, SUBJECTS, CHAPTERS, s, lesson, getLesson } from './schema.js';

import { math1 } from './math1.js';
import { math2 } from './math2.js';
import { math3 } from './math3.js';
import { mathA } from './mathA.js';
import { mathB } from './mathB.js';
import { mathC } from './mathC.js';
import { mathCConics } from './mathC-conics.js';

defineLessons([...math1, ...math2, ...math3, ...mathA, ...mathB, ...mathCConics, ...mathC]);

export const LESSONS = allLessons();
export { SUBJECTS, CHAPTERS, lessonsBySubject, getLesson, s, lesson };
