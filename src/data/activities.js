// SGNY regular activities + per-session detail. Sourced from sgny.org.
// NOTE: the Zoom link is from the SGNY site and should be confirmed current.
export const zoom = {
  url: 'https://us02web.zoom.us/j/81255349276?pwd=d0FyQWx0dDVCRDhZdGdha1o1RjJSUT09',
  id: '812 5534 9276',
  password: 'kardec',
  phone: '+1 (646) 558-8656',
};
export const location = '939 8th Avenue, Suite 409, New York, NY';

// Every session in the weekly schedule, with its own detail page (by slug).
// mode: 'in-person' | 'online' | 'hybrid'.  tags = quick badges shown in the grid.
export const sessions = [
  {
    slug: 'monday-counseling', day: 'Monday', time: '6:00 – 7:00 PM',
    name: 'Individual Spiritual Counseling', mode: 'in-person', tags: [],
    audience: 'Open to the public',
    format: 'A private, one-to-one conversation with a volunteer for anyone seeking a listening ear and spiritual orientation.',
    notes: [],
  },
  {
    slug: 'monday-fraternal-assistance', day: 'Monday', time: '7:00 – 8:00 PM',
    name: 'Fraternal Assistance (Passes)', mode: 'hybrid', tags: ['Passes: in-person only'],
    audience: 'Open to the public',
    format: 'A brief lecture (streamed online) followed by the laying on of hands (passes), given in person only.',
    material: 'Currently reading “Living Spring,” from the spirit Emmanuel through the mediumship of Francisco C. Xavier.',
    notes: [
      'Please be prompt — doors close at 7:00 PM, or once we reach full capacity. Late arrivals cannot be admitted.',
      'At the end, we ask everyone to leave promptly and in silence so the Mediumship Meeting can begin undisturbed.',
    ],
  },
  {
    slug: 'monday-mediumship', day: 'Monday', time: '8:00 – 9:00 PM',
    name: 'Mediumship Meeting', mode: 'in-person', tags: ['Invitation only'],
    audience: 'Closed to the public',
    format: 'The mediumistic work of the group — fraternal assistance to errant spirits, carried out by prepared volunteers.',
    notes: ['This is a closed working session and is not open to visitors.'],
  },
  {
    slug: 'tuesday-prayer-group', day: 'Tuesday', time: '10:00 – 10:30 AM',
    name: 'Prayer Group', mode: 'online', tags: ['By appointment'],
    audience: 'By appointment only',
    format: 'A gathering for prayer, held online.',
    notes: ['To take part, please contact one of the coordinators of the Tuesday Study Group just before its meeting.'],
  },
  {
    slug: 'tuesday-study-group', day: 'Tuesday', time: '12:00 – 1:30 PM',
    name: 'Study Group', mode: 'online', tags: [],
    audience: 'Open to the public · no appointment needed',
    material: 'Study of Spiritism — “The Spirits’ Book” by Allan Kardec.',
    objectives: 'Designed for those who want to learn the basics of Spiritism or consolidate what they already know, drawing on the core principles of the Spiritist Codification.',
    format: 'Reading and discussion of topics, with occasional lectures, followed by passes.',
    notes: [],
  },
  {
    slug: 'wednesday-book-club', day: 'Wednesday', time: '7:00 – 8:00 PM',
    name: 'Book Club', mode: 'online', tags: ['Summer break', 'Back in August'],
    audience: 'Open to the public · no appointment needed',
    material: '“Prelude to the Divine Kingdom” by Divaldo Franco and Amália Rodrigues (spirit). The book is available for purchase at SGNY.',
    format: 'Reading and discussion.',
    notes: [
      'The Book Club is on summer vacation and will resume in August.',
      'Discussion is limited to the book currently adopted.',
      'No fraternal assistance or passes are provided.',
      'This activity is a reading group, not a Spiritist study.',
    ],
  },
  {
    slug: 'thursday-counseling', day: 'Thursday', time: '6:00 – 7:00 PM',
    name: 'Individual Spiritual Counseling', mode: 'in-person', tags: [],
    audience: 'Open to the public',
    format: 'A private, one-to-one conversation with a volunteer for anyone seeking a listening ear and spiritual orientation.',
    notes: [],
  },
  {
    slug: 'thursday-study-group', day: 'Thursday', time: '7:00 – 8:00 PM',
    name: 'Study Group', mode: 'hybrid', tags: [],
    audience: 'Open to the public',
    format: 'Reading and discussion of Spiritism, offered both in person and online.',
    notes: [],
  },
  {
    slug: 'sunday-study-group', day: 'Sunday', time: '11:00 AM – 1:00 PM',
    name: 'Study Group', mode: 'online', tags: [],
    audience: 'Open to the public',
    format: 'Reading and discussion of Spiritism, held online.',
    notes: [],
  },
  {
    slug: 'sunday-qa', day: 'Sunday', time: '11:00 AM – 12:30 PM',
    name: 'Question & Answer', mode: 'online', tags: ['4th Sunday only'],
    audience: 'Open to the public — newcomers welcome',
    format: 'An informal session, held online, where newcomers can ask anything about Spiritism.',
    notes: ['Held on the fourth Sunday of each month.'],
  },
];

// The "what to expect" cards.
export const activities = [
  { name: 'Fraternal Assistance', audience: 'Open to all', icon: '🤝',
    desc: 'Spiritual support and a fraternal conversation, followed by the laying on of hands (passes).' },
  { name: 'Study Group', audience: 'Open to all', icon: '📖',
    desc: 'Guided study of a Spiritist work, chapter by chapter — held Sunday, Tuesday, and Thursday.' },
  { name: 'Prayer Group', audience: 'By appointment', icon: '🕊️',
    desc: 'A gathering for prayer that prepares us for study and charity. Held online.' },
  { name: 'Question & Answer', audience: 'Newcomers welcome', icon: '💬',
    desc: 'An informal session for newcomers to ask anything about Spiritism. Online, 4th Sunday monthly.' },
  { name: 'Individual Spiritual Counseling', audience: 'Open to all', icon: '🌿',
    desc: 'A private, confidential conversation for anyone going through a difficult moment.' },
  { name: 'Book Club', audience: 'Open to all', icon: '📚',
    desc: 'A relaxed reading and discussion of a Spiritist book — currently “Prelude to the Divine Kingdom.” On summer vacation; back in August.' },
  { name: 'Mediumship Meeting', audience: 'Prepared workers', icon: '🔆',
    desc: 'The mediumistic work of the group, carried out by prepared volunteers. Closed to the public.' },
];

// Weekly schedule grouped by day (derived from sessions, order preserved).
export const schedule = (() => {
  const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Sunday'];
  return order.map((day) => ({ day, sessions: sessions.filter((s) => s.day === day) }));
})();
