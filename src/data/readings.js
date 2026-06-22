// Additional Readings — PDF library. Covers are first-page thumbnails of each PDF.
const cover = (f) => `/covers/readings/${f}.png`;

export const readingSections = [
  {
    title: 'SGNY’s Mediumship Course',
    blurb: 'The complete course materials used in our mediumship study, in two programs.',
    items: [
      { title: 'Program I — Part 1', pdf: '/uploads/2024/05/P1MediumshipCourse2019.pdf', cover: cover('P1MediumshipCourse2019') },
      { title: 'Program I — Part 2', pdf: '/uploads/2024/05/P2MedCourse2019.pdf', cover: cover('P2MedCourse2019') },
      { title: 'Program II — Part 1A', pdf: '/uploads/2013/01/MedCourseP2Part1-2013.pdf', cover: cover('MedCourseP2Part1-2013') },
      { title: 'Program II — Part 1B', pdf: '/uploads/2013/01/MedCourse2Part2-2013.pdf', cover: cover('MedCourse2Part2-2013') },
    ],
  },
  {
    title: 'General Study',
    blurb: 'Foundational reading for the study of Spiritism.',
    items: [
      { title: 'The Apostles', pdf: '/pdf/Apostles.pdf', cover: cover('Apostles') },
    ],
  },
  {
    title: 'Mediumship',
    blurb: 'A four-part series on the study and practice of mediumship.',
    items: [
      { title: 'Mediumship Education I', pdf: '/pdf/me_01.pdf', cover: cover('me_01') },
      { title: 'Mediumship Education II', pdf: '/pdf/me_02.pdf', cover: cover('me_02') },
      { title: 'Mediumship Education III', pdf: '/pdf/me_03.pdf', cover: cover('me_03') },
      { title: 'Mediumship Education IV', pdf: '/pdf/me_04.pdf', cover: cover('me_04') },
    ],
  },
  {
    title: 'Articles',
    blurb: 'Short thematic explorations of Spiritist ideas.',
    items: [
      { title: 'What Was the Real Face of Jesus?', pdf: '/pdf/01fj.pdf', cover: cover('01fj') },
      { title: 'North Americans and Spiritism', pdf: '/pdf/02nas.pdf', cover: cover('02nas') },
      { title: 'Spiritism: Science, Philosophy and Religion', pdf: '/pdf/03sspr.pdf', cover: cover('03sspr') },
      { title: 'Spiritism — Basic Knowledge', pdf: '/pdf/04PGIC.pdf', cover: cover('04PGIC') },
      { title: 'Religious Leaders’ Commitment to Global Peace', pdf: '/pdf/05itati.pdf', cover: cover('05itati') },
      { title: 'Gestalt and the Spiritist Doctrine', pdf: '/pdf/06gestalt.pdf', cover: cover('06gestalt') },
    ],
  },
  {
    title: 'Preparation of Workers',
    blurb: 'Guidance on Spiritist activities, from the International Spiritist Council.',
    items: [
      { title: 'Preparation of Workers', pdf: '/pdf/PreparationofWorkers.pdf', cover: cover('PreparationofWorkers') },
    ],
  },
];
