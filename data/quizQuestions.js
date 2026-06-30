// data/quizQuestions.js
// ------------------------------------------------------------
// Real Reze Blox YT quiz questions with answer key.
// IMPORTANT: correctAnswer is used on the server only for scoring.
// Never send correctAnswer to frontend templates or browser JavaScript.
// ------------------------------------------------------------

const quizQuestions = [
  {
    id: 1,
    text: 'Which boss drops the Dark Coat?',
    choices: ['Don Swan', 'Darkbeard', 'Greybeard', 'rip_indra'],
    correctAnswer: 1
  },
  {
    id: 2,
    text: 'Which fighting style requirement is needed to obtain Godhuman?',
    choices: ['Superhuman only', 'Electric Claw only', 'Dragon Talon only', 'You need to master multiple fighting styles'],
    correctAnswer: 3
  },
  {
    id: 3,
    text: 'What level do you need to enter the Second Sea?',
    choices: ['500', '700', '1000', '1500'],
    correctAnswer: 3
  },
  {
    id: 4,
    text: 'Which NPC sells Fighting Styles?',
    choices: ['Blox Fruit Dealer', 'Ability Teacher', 'Fighting Style Teacher', 'Blacksmith'],
    correctAnswer: 3
  },
  {
    id: 5,
    text: 'What is the maximum mastery level for most weapons and fighting styles?',
    choices: ['400', '500', '600', '700'],
    correctAnswer: 3
  },
  {
    id: 6,
    text: 'Which fruit is best known for grinding in the First Sea?',
    choices: ['Flame', 'Light', 'Bomb', 'Sand'],
    correctAnswer: 1
  },
  {
    id: 7,
    text: 'Which item summons rip_indra?',
    choices: ["God's Chalice", 'Fist of Darkness', 'Red Key', 'Hellfire Torch'],
    correctAnswer: 0
  },
  {
    id: 8,
    text: 'Which fighting style is required to unlock Godhuman?',
    choices: ['Dragon Talon', 'Sharkman Karate', 'Electric Claw', 'All of the above'],
    correctAnswer: 3
  },
  {
    id: 9,
    text: 'Which NPC lets you reset your stats using Fragments?',
    choices: ['Plokster', 'Mysterious Scientist', 'Trevor', 'Blox Fruit Dealer'],
    correctAnswer: 0
  },
  {
    id: 10,
    text: 'Which fruit is famous for fast travel?',
    choices: ['Light', 'Love', 'Rocket', 'Falcon'],
    correctAnswer: 0
  },
  {
    id: 11,
    text: 'Which fruit replaced Kilo?',
    choices: ['Rocket', 'Spin', 'Falcon', 'Diamond'],
    correctAnswer: 0
  },
  {
    id: 12,
    text: 'Which boss drops the Buddy Sword?',
    choices: ['Big Mom', 'Dough King', 'Cake Prince', 'Longma'],
    correctAnswer: 0
  },
  {
    id: 13,
    text: 'Which item combination is used to summon Dough King?',
    choices: ["God's Chalice + 10 Conjured Cocoa", "God's Chalice + Sweet Chalice", 'Fist of Darkness', 'Mirror Fractal'],
    correctAnswer: 0
  },
  {
    id: 14,
    text: 'Which boss drops the Pale Scarf?',
    choices: ['Cake Prince', 'Dough King', 'Stone', 'Both A and B'],
    correctAnswer: 3
  },
  {
    id: 15,
    text: 'How many Elite Pirates must you defeat to unlock Yama?',
    choices: ['20', '25', '30', '35'],
    correctAnswer: 2
  },
  {
    id: 16,
    text: 'Which fruit has the largest transformation model?',
    choices: ['Mammoth', 'Yeti (Fiend)', 'Yeti', 'Buddha'],
    correctAnswer: 3
  },
  {
    id: 17,
    text: 'Which sword has the move "Dimension Slash"?',
    choices: ['Shisui', 'Yama', 'Dark Blade', 'Tushita'],
    correctAnswer: 2
  },
  {
    id: 18,
    text: 'Which fruit is the fastest?',
    choices: ['Pain', 'Light', 'Kitsune', 'Yeti'],
    correctAnswer: 1
  },
  {
    id: 19,
    text: 'Which powerful sword got nerfed in the Dragon update?',
    choices: ['Shark Anchor', 'CDK (Cursed Dual Katana)', 'Hallow Scythe', 'TTK (True Triple Katana)'],
    correctAnswer: 1
  },
  {
    id: 20,
    text: 'Which material is NOT used for the Soul Guitar?',
    choices: ['Bones', 'Ectoplasm', 'Dark Fragment', 'Magma Ore'],
    correctAnswer: 3
  }
];

module.exports = quizQuestions;
