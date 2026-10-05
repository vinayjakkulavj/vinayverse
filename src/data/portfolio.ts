import { professionalResume } from './resume';

export type WorldId = 'professional' | 'know-me' | 'pandora';

export type Topic = {
  slug: string;
  title: string;
  world: WorldId;
  eyebrow: string;
  description: string;
  quote: string;
  sections: { title: string; body: string; items?: string[] }[];
  kind: 'overview' | 'moon' | 'constellation';
  status?: 'Built' | 'Building' | 'Exploring';
};

export type World = {
  id: WorldId;
  slug: string;
  title: string;
  subtitle: string;
  color: string;
  topics: string[];
};

export const worlds: World[] = [
  {
    id: 'professional',
    slug: 'professional',
    title: 'Professional',
    subtitle: 'Experience · Skills · Achievements',
    color: '#7aaee8',
    topics: ['experience', 'skills', 'achievements'],
  },
  {
    id: 'know-me',
    slug: 'know-me',
    title: 'Know Me',
    subtitle: 'Curiosity · people · peace',
    color: '#a891ff',
    topics: ['beyond', 'wonder', 'peace', 'alternate'],
  },
  {
    id: 'pandora',
    slug: 'project-pandora',
    title: 'Project Pandora',
    subtitle: 'Where ideas become experiments',
    color: '#4ecdb9',
    topics: ['tools', 'ideas', 'experiments', 'stories'],
  },
];

export const topics: Topic[] = [
  {
    slug: 'professional',
    title: 'Professional',
    world: 'professional',
    eyebrow: 'Professional Summary',
    kind: 'overview',
    description: professionalResume.summary,
    quote: '',
    sections: [],
  },
  {
    slug: 'experience',
    title: 'Experience',
    world: 'professional',
    eyebrow: 'Employment History',
    kind: 'moon',
    description: '',
    quote: '',
    sections: [],
  },
  {
    slug: 'skills',
    title: 'Skills',
    world: 'professional',
    eyebrow: 'Technical Skills',
    kind: 'moon',
    description: '',
    quote: '',
    sections: [],
  },
  {
    slug: 'achievements',
    title: 'Achievements',
    world: 'professional',
    eyebrow: 'Professional Achievements',
    kind: 'moon',
    description: '',
    quote: '',
    sections: [],
  },
  {
    slug: 'know-me',
    title: 'Know Me',
    world: 'know-me',
    eyebrow: 'Know Me world',
    kind: 'overview',
    description: 'People usually meet the chill version first. The rest takes a little more exploration.',
    quote: 'You probably know one version of me. There are a few more orbiting around.',
    sections: [
      { title: 'Curious', body: 'Science, politics, human behavior and technology can all pull me into a conversation. I am especially drawn to questions that do not arrive with an easy answer.' },
      { title: 'Close to people', body: 'I am easygoing with most people. With the people I am close to, I become more sensitive, more invested and more likely to overthink.' },
      { title: 'An imaginary dance floor', body: 'Some songs come with choreography only I can see. I enjoy dancing and have given a few performances in school and college. Often, while listening to music, I’m building a routine in my head. Those imagined dances have stayed there so far.' },
      { title: 'At ease', body: 'Rain, cloudy skies, mountains, a beach at night, music, my village and sometimes just my room. The setting can be simple and still mean a lot.' },
      { title: 'Somewhere else', body: 'Space, time travel, ancient civilizations and alternate lives keep my imagination moving. Behind all of those possibilities is a quieter wish for a peaceful future.' },
    ],
  },
  {
    slug: 'beyond',
    title: 'Beyond the Chill Guy',
    world: 'know-me',
    eyebrow: 'Know Me · A closer look',
    kind: 'moon',
    description: 'Most people see someone who laughs, jokes and keeps things easy. There is a quieter version behind that too.',
    quote: 'The lighter version of me is real. So is the quieter one behind it.',
    sections: [
      { title: 'What people see', body: 'Chill, easygoing and laughing often. I usually like making other people laugh too; humor is one of the ways I connect.' },
      { title: 'The routine in my head', body: 'Dance is another way I enjoy expressing myself. I’ve given a few performances in school and college, so this part of me has had its moments in front of an audience.\n\nA song often sets a whole routine running in my mind: steps, movements and a performance only I can see. Those imagined routines haven’t made it into real life. For now, some of my dance floors exist entirely in my head.' },
      { title: 'What stays underneath', body: 'I overthink more than people expect. I am most sensitive around the people I am close to, because those relationships carry more weight for me.' },
      { title: 'Connection', body: 'Expressive eye contact and someone being present with me mean more than a formal gesture. I notice the small signals that tell me a conversation matters to both of us.' },
      { title: 'Respect', body: 'Being ignored, dismissed or judged after opening up affects me more than a casual disagreement. Letting someone see more of me is something I take seriously.' },
    ],
  },
  {
    slug: 'wonder',
    title: 'Things I Wonder About',
    world: 'know-me',
    eyebrow: 'Know Me · Curiosity',
    kind: 'moon',
    description: 'The questions I return to are usually bigger than the answers available.',
    quote: 'I like questions that keep the imagination working after the video ends.',
    sections: [
      { title: 'Origins', body: 'Where did humans really come from? Why did intelligence evolve so differently in us? I am fascinated by the path from living organisms to beings who can ask about their own origins.' },
      { title: 'Existence', body: 'Does God exist, and what would a definite answer change? I am interested in the question itself and in the ways people make sense of it.' },
      { title: 'Life', body: 'Why does Earth seem so extraordinary for living organisms? Are we alone? Thinking about the scale of space makes those questions hard to put down.' },
      { title: 'Time', body: 'Even if time travel is impossible, I would still want to understand exactly why. The idea lives somewhere between curiosity, science fiction and all the lives that could have been.' },
    ],
  },
  {
    slug: 'peace',
    title: 'My Kind of Peace',
    world: 'know-me',
    eyebrow: 'Know Me · Quiet places',
    kind: 'moon',
    description: 'Rain, cold weather, cloudy skies, stars, music or silence. My favorite atmosphere is rarely loud.',
    quote: 'Sometimes peace is weather, music and the people beside you.',
    sections: [
      { title: 'The weather', body: 'Rain, cold air and cloudy skies instantly feel calmer to me. They change the mood of an ordinary place without asking for anything else.' },
      { title: 'The places', body: 'A quiet hill stay, a beach at night, my village or simply my own room. I can find that feeling in a journey or somewhere familiar.' },
      { title: 'The sound', body: 'Soothing instrumental music helps when my thoughts are loud. Sometimes even music feels like too much, and complete silence feels right.' },
      { title: 'The journey', body: 'Changing landscapes, an open bus window, a train journey, good music and the right people. Often it is the time in between places that I remember wanting more of.' },
    ],
  },
  {
    slug: 'alternate',
    title: 'Alternate Lives',
    world: 'know-me',
    eyebrow: 'Know Me · Other possibilities',
    kind: 'moon',
    description: 'If life had branched differently, I can imagine three versions of myself surprisingly clearly.',
    quote: 'The lives are different. The curiosity and need for freedom are the same.',
    sections: [
      { title: 'Astrophysicist', body: 'A life spent understanding the universe. The questions that fascinate me would become the work I returned to every day.' },
      { title: 'Tech creator', body: 'Talking about gadgets, launches and technical details is something I have naturally done for friends and family for years. I can imagine giving that interest a bigger space.' },
      { title: 'Farmer', body: 'A quieter life closer to my village, the land and family. A slower routine has an appeal of its own.' },
      { title: 'The real dream', body: 'A beautiful family, less stressful work, travel and enough freedom to enjoy the life around the work. That wish fits into every version.' },
    ],
  },
  {
    slug: 'project-pandora',
    title: 'Project Pandora',
    world: 'pandora',
    eyebrow: 'Project Pandora world',
    kind: 'overview',
    description: 'Tools, utilities, concepts and stories. A place for the things I build because I cannot leave the problem or possibility alone.',
    quote: 'Not every useful idea begins with a roadmap. Sometimes it begins with irritation.',
    sections: [
      { title: 'Built', body: 'Useful things that crossed the line from idea to working solution: utilities, automations and prototypes that gave a thought something concrete to do.' },
      { title: 'Building', body: 'Concepts becoming products, prototypes or experiments. This universe is one of those ideas taking shape.' },
      { title: 'Exploring', body: 'Some questions need more space before they become projects. They belong here while I work out what they are asking and what an answer could look like.' },
      { title: 'Why Pandora', body: 'I want this space to show the thinking and experimentation behind what I create, including the ideas that are still finding their form.' },
    ],
  },
  {
    slug: 'tools',
    title: 'Tools That Shouldn’t Have Been Manual',
    world: 'pandora',
    eyebrow: 'Project Pandora · Useful irritation',
    kind: 'moon',
    status: 'Built',
    description: 'The fastest way to get my attention is to make me repeat the same manual effort often enough.',
    quote: 'Repetition is usually the first sign that there may be a better design.',
    sections: [
      { title: 'The pattern', body: 'If I am doing something manually again and again, I start looking for the repeatable logic. Repetition gives me a place to begin.' },
      { title: 'The question', body: 'Can the system do this instead of the person? I look for the parts that can become a dependable process and the decisions that still need someone’s judgment.' },
      { title: 'The forms it takes', body: 'That instinct shows up in different kinds of useful work.', items: ['Incident analysis utilities', 'Data helpers', 'Workflow shortcuts', 'Internal productivity tools'] },
      { title: 'The goal', body: 'Reduce unnecessary effort and keep the solution easy to use. A useful tool should make the repeated task feel lighter.' },
    ],
  },
  {
    slug: 'ideas',
    title: 'Ideas I Still Think About',
    world: 'pandora',
    eyebrow: 'Project Pandora · Unfinished possibilities',
    kind: 'moon',
    status: 'Exploring',
    description: 'Some ideas are useful enough that I keep mentally designing their next version after the original project ends.',
    quote: 'Unrealized potential can be more motivating than a finished feature.',
    sections: [
      { title: 'Lineage', body: 'The lineage utility is one of those ideas. People used it, and I still believe it had the potential to become a broader internal product.' },
      { title: 'The product instinct', body: 'Once an idea is useful, I start wondering what it could become with continued development and clear ownership. Usage opens up the next set of questions.' },
      { title: 'The unfinished part', body: 'Not every concept gets the timing, sponsorship or space it needs. The original project can end while the problem and its possibilities remain interesting.' },
      { title: 'The Pandora rule', body: 'Keep the good idea alive. Sometimes returning to a thought is how I learn which part of it still deserves to be built.' },
    ],
  },
  {
    slug: 'experiments',
    title: 'Experiments',
    world: 'pandora',
    eyebrow: 'Project Pandora · In progress',
    kind: 'moon',
    status: 'Building',
    description: 'A living area for things that are built, building or still being explored.',
    quote: 'The purpose of an experiment is to answer something.',
    sections: [
      { title: 'Built', body: 'Utilities, automations and working prototypes. Each one gives an idea a form that someone can actually use or respond to.' },
      { title: 'Building', body: 'Interactive portfolio ideas, JobLens concepts and personal product experiments. These are places where a question starts turning into an interface or a tool.' },
      { title: 'Exploring', body: 'AI assisted workflows, new interfaces and ways to make information easier to discover. I am interested in the practical question underneath the new technology.' },
      { title: 'The rule', body: 'Experiments can be incomplete and still useful. I want each one to have a clear reason to exist and a question it helps me understand.' },
    ],
  },
  {
    slug: 'stories',
    title: 'Stories From My Head',
    world: 'pandora',
    eyebrow: 'Project Pandora · Creative orbit',
    kind: 'moon',
    status: 'Exploring',
    description: 'Science fiction ideas, fictional situations and stories that exist outside engineering.',
    quote: 'I would rather people discover the creative side naturally than hear me announce it.',
    sections: [
      { title: 'Science fiction', body: 'I naturally imagine myself inside the worlds I watch, especially anything involving time travel. The story carries on in my head after the screen goes quiet.' },
      { title: 'Writing', body: 'Stories give the ideas that do not belong in code somewhere to exist. They let a question become a situation, a person or an entire world.' },
      { title: 'The recurring ingredients', body: 'Ancient civilizations, space, time, human behavior and alternate realities keep finding their way into the things I imagine.' },
      { title: 'Why it belongs here', body: 'Creativity runs through useful work and through the ideas nobody asked me to build. This is a place to let that part of me be discovered too.' },
    ],
  },
  {
    slug: 'soundtrack',
    title: 'My Quiet Soundtrack',
    world: 'know-me',
    eyebrow: 'Hidden constellation · Sound',
    kind: 'constellation',
    description: 'Soothing instrumental music, changing landscapes and the moments when silence feels better.',
    quote: 'Sometimes the right soundtrack is no soundtrack at all.',
    sections: [
      { title: 'When thoughts are loud', body: 'Soothing instrumental music is one of the ways I find a calmer atmosphere. It leaves room for the thoughts without filling every part of it.' },
      { title: 'In motion', body: 'Good music belongs to the travel moments I enjoy: a window, changing landscapes and the right people beside me.' },
      { title: 'A little choreography', body: 'A song can be a quiet companion or an imaginary dance floor. I often choreograph it in my mind while listening, giving the music a routine that hasn’t become a real performance.' },
      { title: 'When quiet is enough', body: 'Sometimes even music feels like too much. Complete silence has its own place.' },
    ],
  },
  {
    slug: 'on-the-road',
    title: 'On the Road',
    world: 'know-me',
    eyebrow: 'Hidden constellation · Travel',
    kind: 'constellation',
    description: 'An open window, a changing landscape, good music and good company.',
    quote: 'The time between places can become part of the place I remember.',
    sections: [
      { title: 'The journey', body: 'An open bus window, a train journey and the landscape changing outside. Travel has an atmosphere I enjoy before I arrive anywhere.' },
      { title: 'The setting', body: 'Mountains, a quiet hill stay and a beach at night are places I associate with peace. Rain and cold air make the feeling even better.' },
      { title: 'The people', body: 'Good music helps. The right people make it mean more. Travel is also part of the future I imagine with more freedom around work.' },
    ],
  },
  {
    slug: 'small-things',
    title: 'The Small Things',
    world: 'know-me',
    eyebrow: 'Hidden constellation · Everyday peace',
    kind: 'constellation',
    description: 'Cloudy skies, my village, my room and someone who is really present in a conversation.',
    quote: 'A moment can be small and still matter a lot.',
    sections: [
      { title: 'A familiar place', body: 'My village and my room can feel as peaceful as a place I traveled to find. Familiarity has a comfort of its own.' },
      { title: 'A change in the weather', body: 'Rain, cold air, cloudy skies and a starry night can change the feeling of the day. I notice those shifts.' },
      { title: 'A real connection', body: 'Expressive eye contact, laughter and someone being present matter to me. Those small signals are often the things I remember.' },
    ],
  },
  {
    slug: 'science',
    title: 'Questions Without an Edge',
    world: 'know-me',
    eyebrow: 'Hidden constellation · Science',
    kind: 'constellation',
    description: 'Human origins, the possibility of life elsewhere and a universe that keeps giving me new questions.',
    quote: 'Curiosity does not need the answer to be close.',
    sections: [
      { title: 'Where we came from', body: 'Human origins and the evolution of intelligence are questions I keep returning to. I want to understand the path that led to us.' },
      { title: 'Who else is out there', body: 'Earth, living organisms and the scale of space make the possibility of life elsewhere hard to stop thinking about.' },
      { title: 'A different life', body: 'Astrophysics is one of the alternate lives I can imagine clearly: turning that fascination into the work of understanding the universe.' },
    ],
  },
  {
    slug: 'what-if',
    title: 'What If?',
    world: 'pandora',
    eyebrow: 'Hidden constellation · Imagination',
    kind: 'constellation',
    status: 'Exploring',
    description: 'Time travel, alternate realities and the stories that start when I imagine myself inside another world.',
    quote: 'One possibility is usually enough to start a story.',
    sections: [
      { title: 'A different branch', body: 'I can imagine other versions of my life as an astrophysicist, a tech creator or a farmer. Thinking about those paths says something about what matters to me here.' },
      { title: 'A different time', body: 'Time travel stories invite me to keep imagining. Even the question of why it might be impossible can hold my attention.' },
      { title: 'A world of my own', body: 'Ancient civilizations, space, human behavior and alternate realities are recurring ingredients in the stories in my head.' },
    ],
  },
];

// Keep previously shared Professional URLs on the resume content.
export const topicAliases: Record<string, string> = {
  lineage: 'experience',
  systems: 'experience',
  journey: 'experience',
  automation: 'achievements',
  impact: 'achievements',
  'engineering-stack': 'skills',
};

export function getTopic(slug: string): Topic | undefined {
  const canonicalSlug = topicAliases[slug] || slug;
  return topics.find((topic) => topic.slug === canonicalSlug);
}

export function getWorld(id: WorldId): World {
  const world = worlds.find((entry) => entry.id === id);
  if (!world) throw new Error(`Unknown world: ${id}`);
  return world;
}
