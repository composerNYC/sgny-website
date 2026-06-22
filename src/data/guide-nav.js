// Ordered reading "tracks" for the Guide to Spiritism, so each page can offer
// previous / next navigation. Order taken from the original guide index pages.
export const tracks = [
  {
    name: 'A Guide to Spiritism',
    index: '/spiritism-guide',
    steps: [
      { path: '/spiritism-guide/a-history', label: 'A History' },
      { path: '/spiritism-guide/the-fundamentals', label: 'The Fundamentals' },
      { path: '/spiritism-guide/teachings-outline', label: 'Outline of the Teachings' },
      { path: '/spiritism-guide/teachings-precepts', label: 'Precepts from the Teachings' },
      { path: '/spiritism-guide/the-5-book-codification', label: 'The Codification & Its Study' },
      { path: '/spiritism-guide/the-5-book-codification-ii', label: 'The Codification — Part II' },
      { path: '/spiritism-guide/spiritism-topics', label: 'Special Topics In-Depth' },
      { path: '/spiritism-guide/spiritism-topics/spiritism-ethics', label: 'Spiritism & Ethics' },
      { path: '/spiritism-guide/spiritism-topics/spiritism-and-identity', label: 'Spiritism & Identity' },
      { path: '/spiritism-guide/myths-and-misconceptions', label: 'Myths & Misconceptions' },
      { path: '/spiritism-guide/spiritist-centers-guide', label: 'Spiritist Centers: A Guide' },
    ],
  },
  {
    name: 'Mediumship',
    index: '/spiritism-guide/mediumship',
    steps: [
      { path: '/spiritism-guide/mediumship', label: 'Mediumship: Introduction' },
      { path: '/spiritism-guide/mediumship/a-spirit', label: 'What Is a Spirit?' },
      { path: '/spiritism-guide/mediumship/spirit-world-and-the-material-worlds', label: 'The Spirit World & the Material World' },
      { path: '/spiritism-guide/mediumship/a-medium', label: 'What Is a Medium? We Are All Mediums' },
      { path: '/spiritism-guide/mediumship/spirit-communication', label: 'Communication Between Medium & Spirit' },
      { path: '/spiritism-guide/mediumship/spirit-evolution', label: 'Spirit Creation & Evolution' },
      { path: '/spiritism-guide/mediumship/communication-workings', label: 'Categories of Communication' },
      { path: '/spiritism-guide/mediumship/physical-phenomena', label: 'Types of Physical Phenomena' },
      { path: '/spiritism-guide/mediumship/intelligent-phenomena', label: 'Types of Intelligent Phenomena' },
      { path: '/spiritism-guide/mediumship/medium-types', label: 'Types of Mediums' },
      { path: '/spiritism-guide/mediumship/mediumship-evolution', label: 'The Evolution of Mediumship' },
      { path: '/spiritism-guide/mediumship/child-mediums', label: 'Child Mediumship / Missionaries' },
      { path: '/spiritism-guide/mediumship/medium-evolution', label: 'The Evolution of the Medium' },
      { path: '/spiritism-guide/mediumship/mediumship-improvement', label: 'Improving the Mediumship' },
      { path: '/spiritism-guide/mediumship/spirit-hierarchy', label: 'The Levels of Spirit Evolution' },
      { path: '/spiritism-guide/mediumship/spirit-pov', label: 'Mediumship from the Spirit’s Point of View' },
      { path: '/spiritism-guide/mediumship/spirit-obsession', label: 'Spirit Obsession & Other Trials' },
      { path: '/spiritism-guide/mediumship/historic-mediums', label: 'Mediumship Through History' },
      { path: '/spiritism-guide/mediumship/other-topics', label: 'Other Topics in Mediumship' },
    ],
  },
];

// Given a path, return { track, index, prev, next } or null if not part of a track.
export function findInTracks(path) {
  const p = path.replace(/\/$/, '');
  for (const track of tracks) {
    const i = track.steps.findIndex((s) => s.path === p);
    if (i !== -1) {
      return {
        track,
        index: i,
        total: track.steps.length,
        prev: i > 0 ? track.steps[i - 1] : null,
        next: i < track.steps.length - 1 ? track.steps[i + 1] : null,
      };
    }
  }
  return null;
}
