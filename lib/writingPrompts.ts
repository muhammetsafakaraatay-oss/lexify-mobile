// Lexify · Writing prompt library
// Static, IELTS-style prompts. We snapshot the chosen prompt onto each
// writing_tasks row at creation time so the user's text stays tied to the
// exact wording they saw — even if this library is edited later.
//
// Naming:
//  - task1_letter : IELTS General Training Task 1 (letter, ~150 words)
//  - task1_chart  : IELTS Academic Task 1 (chart/graph/process, ~150 words)
//  - task2_essay  : IELTS Task 2 essay (~250 words)
//  - free         : Open-ended free writing (no specific target)

export type PromptType = 'task1_letter' | 'task1_chart' | 'task2_essay' | 'free'

export type PromptCategory =
  | 'environment'
  | 'education'
  | 'technology'
  | 'health'
  | 'society'
  | 'globalisation'
  | 'work'
  | 'family'
  | 'transport'
  | 'media'
  | 'government'
  | 'culture'
  | 'travel'
  | 'general'

export type PromptDifficulty = 'easy' | 'medium' | 'hard'

export type WritingPrompt = {
  id: string
  type: PromptType
  category: PromptCategory
  title: string
  body: string
  targetWords: number
  suggestedMinutes: number
  difficulty: PromptDifficulty
  hint?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// UI labels
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPT_TYPE_LABELS: Record<PromptType, { tr: string; short: string }> = {
  task1_letter: { tr: 'Mektup (Task 1 GT)', short: 'Mektup' },
  task1_chart:  { tr: 'Grafik / Süreç (Task 1 Akademik)', short: 'Grafik' },
  task2_essay:  { tr: 'Deneme (Task 2)', short: 'Deneme' },
  free:         { tr: 'Serbest Yazı', short: 'Serbest' },
}

export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  environment:   'Çevre',
  education:     'Eğitim',
  technology:    'Teknoloji',
  health:        'Sağlık',
  society:       'Toplum',
  globalisation: 'Küreselleşme',
  work:          'İş Hayatı',
  family:        'Aile',
  transport:     'Ulaşım',
  media:         'Medya',
  government:    'Yönetim',
  culture:       'Kültür',
  travel:        'Seyahat',
  general:       'Genel',
}

export const PROMPT_DIFFICULTY_LABELS: Record<PromptDifficulty, string> = {
  easy: 'Kolay',
  medium: 'Orta',
  hard: 'Zor',
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt library
// ─────────────────────────────────────────────────────────────────────────────

export const WRITING_PROMPTS: WritingPrompt[] = [
  // ── Task 2 · Opinion ───────────────────────────────────────────────────────
  {
    id: 'opi-001',
    type: 'task2_essay',
    category: 'environment',
    title: 'Plastic packaging ban',
    body: 'Some people believe that governments should ban single-use plastic packaging, while others say this responsibility belongs to consumers and companies. Discuss both views and give your own opinion.',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
    hint: 'Use linkers: on the one hand / however / in my view.',
  },
  {
    id: 'opi-002',
    type: 'task2_essay',
    category: 'education',
    title: 'Homework debate',
    body: 'Some educators argue that children should not be given homework, as it limits their free time and creativity. To what extent do you agree or disagree?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'easy',
  },
  {
    id: 'opi-003',
    type: 'task2_essay',
    category: 'technology',
    title: 'Smartphones in classrooms',
    body: 'In many schools, students are now allowed to use smartphones during lessons. Do the benefits of this policy outweigh the drawbacks?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'opi-004',
    type: 'task2_essay',
    category: 'health',
    title: 'Sugar tax',
    body: 'A growing number of countries are introducing taxes on sugary drinks to fight obesity. Some people support this policy, while others see it as unfair. Discuss both sides and give your opinion.',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'opi-005',
    type: 'task2_essay',
    category: 'society',
    title: 'Working from home',
    body: 'Since the pandemic, many companies have allowed employees to work from home permanently. Do you think this is a positive or negative development for society?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'opi-006',
    type: 'task2_essay',
    category: 'globalisation',
    title: 'English as a global language',
    body: 'English has become the dominant language for science, business and travel. Some say this threatens cultural diversity. To what extent do you agree?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'hard',
  },
  {
    id: 'opi-007',
    type: 'task2_essay',
    category: 'work',
    title: 'Retirement age',
    body: 'In many countries, the retirement age is being raised. Is this a positive or a negative trend?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'opi-008',
    type: 'task2_essay',
    category: 'family',
    title: 'Parents and screen time',
    body: 'Some people argue that parents are mainly responsible for limiting how much time children spend on screens; others say schools and governments must play a role. Discuss both views and give your opinion.',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'opi-009',
    type: 'task2_essay',
    category: 'transport',
    title: 'Banning cars from city centres',
    body: 'Some cities have banned private cars from their centres to reduce pollution. Do you think this approach is effective? What other steps could be taken?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'opi-010',
    type: 'task2_essay',
    category: 'media',
    title: 'Trust in news',
    body: 'Many people no longer trust traditional news outlets and rely on social media for information. What are the causes of this trend, and what problems can it create?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'hard',
  },

  // ── Task 2 · Discussion ────────────────────────────────────────────────────
  {
    id: 'dis-001',
    type: 'task2_essay',
    category: 'education',
    title: 'Online vs. classroom learning',
    body: 'Some people prefer online courses, while others believe classroom learning is more effective. Discuss both views and give your opinion.',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'dis-002',
    type: 'task2_essay',
    category: 'culture',
    title: 'Museums: free or paid?',
    body: 'Some argue that museums and art galleries should be free for everyone, while others say charging an entrance fee helps maintain them. Discuss both views.',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'easy',
  },
  {
    id: 'dis-003',
    type: 'task2_essay',
    category: 'government',
    title: 'Funding the arts',
    body: 'Some people think governments should spend money on supporting the arts; others believe public money is better spent on healthcare and infrastructure. Discuss both views and give your opinion.',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'dis-004',
    type: 'task2_essay',
    category: 'travel',
    title: 'Tourism and the environment',
    body: 'Some people believe tourism brings economic benefits to host countries, while others claim it damages the environment and local culture. Discuss both sides and give your view.',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'dis-005',
    type: 'task2_essay',
    category: 'technology',
    title: 'Artificial intelligence at work',
    body: 'AI tools are increasingly used to automate tasks at work. Some welcome this as progress, others fear losing their jobs. Discuss both views and give your own opinion.',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'hard',
  },

  // ── Task 2 · Problem / Solution ────────────────────────────────────────────
  {
    id: 'pro-001',
    type: 'task2_essay',
    category: 'environment',
    title: 'Air pollution in cities',
    body: 'Many large cities suffer from severe air pollution. What are the main causes, and what measures can be taken to address the problem?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'pro-002',
    type: 'task2_essay',
    category: 'health',
    title: 'Childhood obesity',
    body: 'Childhood obesity is rising in many countries. What are the causes of this problem, and what solutions can you suggest?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'pro-003',
    type: 'task2_essay',
    category: 'society',
    title: 'Loneliness in modern life',
    body: 'In many modern societies, people report feeling lonelier than ever before. What do you think are the main reasons, and how can this issue be addressed?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'hard',
  },
  {
    id: 'pro-004',
    type: 'task2_essay',
    category: 'transport',
    title: 'Traffic congestion',
    body: 'Traffic congestion is a serious problem in many cities around the world. What are the main causes, and what can governments and individuals do to reduce it?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'easy',
  },
  {
    id: 'pro-005',
    type: 'task2_essay',
    category: 'education',
    title: 'University drop-out rates',
    body: 'In some countries, a large number of students fail to complete their university degrees. What are the reasons for this, and what can universities do to improve the situation?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },

  // ── Task 2 · Advantages / Disadvantages ────────────────────────────────────
  {
    id: 'adv-001',
    type: 'task2_essay',
    category: 'globalisation',
    title: 'Living abroad',
    body: 'More and more people are choosing to live and work in a country other than their own. What are the advantages and disadvantages of this trend?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'adv-002',
    type: 'task2_essay',
    category: 'technology',
    title: 'Cashless societies',
    body: 'Many countries are moving towards cashless payment systems. What are the advantages and disadvantages of this development?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'adv-003',
    type: 'task2_essay',
    category: 'family',
    title: 'Children using social media',
    body: 'Today, children as young as ten regularly use social media platforms. What are the advantages and disadvantages of this?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'adv-004',
    type: 'task2_essay',
    category: 'work',
    title: 'Freelance work',
    body: 'A growing number of professionals choose to work as freelancers rather than for a single employer. Do the advantages of this lifestyle outweigh the disadvantages?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'adv-005',
    type: 'task2_essay',
    category: 'travel',
    title: 'Studying abroad',
    body: 'Many young people now choose to attend university in a foreign country. Do the benefits of studying abroad outweigh the drawbacks?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'easy',
  },

  // ── Task 2 · Two-part questions ────────────────────────────────────────────
  {
    id: 'two-001',
    type: 'task2_essay',
    category: 'culture',
    title: 'Disappearing traditions',
    body: 'Many traditional customs are disappearing in modern societies. Why is this happening, and is it a positive or a negative development?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'hard',
  },
  {
    id: 'two-002',
    type: 'task2_essay',
    category: 'health',
    title: 'Mental health awareness',
    body: 'In recent years there has been more public attention on mental health. Why has this happened, and how can people best take care of their mental well-being?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'two-003',
    type: 'task2_essay',
    category: 'government',
    title: 'Voter turnout',
    body: 'In many democracies, fewer young people vote in elections. Why might this be, and what can be done to encourage them to participate?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'hard',
  },
  {
    id: 'two-004',
    type: 'task2_essay',
    category: 'media',
    title: 'Celebrity culture',
    body: 'Celebrities receive a great deal of media attention. Why are people so interested in celebrities, and is this a positive or negative trend?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'medium',
  },
  {
    id: 'two-005',
    type: 'task2_essay',
    category: 'environment',
    title: 'Recycling habits',
    body: 'Despite awareness campaigns, many households still do not recycle. Why do you think this is, and what can be done to change it?',
    targetWords: 250,
    suggestedMinutes: 40,
    difficulty: 'easy',
  },

  // ── Task 1 · Letters (General Training) ────────────────────────────────────
  {
    id: 'let-001',
    type: 'task1_letter',
    category: 'general',
    title: 'Complaint to a landlord',
    body: `You recently moved into a new flat, but several things in the flat are not working properly.\n\nWrite a letter to your landlord. In your letter:\n• describe the problems\n• explain how they affect you\n• say what you would like the landlord to do.\n\nBegin "Dear Sir or Madam,".`,
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'easy',
    hint: 'Use formal tone: I am writing to / I would be grateful if ...',
  },
  {
    id: 'let-002',
    type: 'task1_letter',
    category: 'work',
    title: 'Request time off',
    body: `You need to take a week off work for a personal matter.\n\nWrite a letter to your manager. In your letter:\n• explain why you need the time off\n• suggest how your work will be covered\n• request approval.\n\nBegin "Dear ...,".`,
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'easy',
  },
  {
    id: 'let-003',
    type: 'task1_letter',
    category: 'travel',
    title: 'Inviting a friend',
    body: `A friend from another country is planning to visit your city.\n\nWrite a letter to your friend. In your letter:\n• say what they should bring\n• describe places you will visit together\n• explain what they can expect from the trip.\n\nBegin "Dear ...,".`,
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'easy',
  },
  {
    id: 'let-004',
    type: 'task1_letter',
    category: 'general',
    title: 'Thank-you letter',
    body: `Someone helped you when you were having a difficult time.\n\nWrite a letter to thank them. In your letter:\n• explain what they did for you\n• say how their help made a difference\n• suggest how you could repay them in the future.\n\nBegin "Dear ...,".`,
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'easy',
  },
  {
    id: 'let-005',
    type: 'task1_letter',
    category: 'general',
    title: 'Apologise to a friend',
    body: `You forgot an important event organised by a close friend.\n\nWrite a letter to apologise. In your letter:\n• explain why you missed it\n• apologise sincerely\n• suggest a way to make it up to them.\n\nBegin "Dear ...,".`,
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'easy',
  },
  {
    id: 'let-006',
    type: 'task1_letter',
    category: 'work',
    title: 'Apply for a part-time job',
    body: `You saw a part-time job advertised in a local café.\n\nWrite a letter to the manager. In your letter:\n• say why you are interested in the job\n• describe relevant experience and skills\n• explain when you would be available.\n\nBegin "Dear Sir or Madam,".`,
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'medium',
  },
  {
    id: 'let-007',
    type: 'task1_letter',
    category: 'general',
    title: 'Lost item on a bus',
    body: `You left an important bag on a bus.\n\nWrite a letter to the bus company. In your letter:\n• give details about the journey\n• describe the bag and its contents\n• explain what you would like them to do.\n\nBegin "Dear Sir or Madam,".`,
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'medium',
  },
  {
    id: 'let-008',
    type: 'task1_letter',
    category: 'education',
    title: 'Course information request',
    body: `You want to take a short evening course at a local college.\n\nWrite a letter to the course administrator. In your letter:\n• say what course you are interested in\n• ask about the schedule and price\n• explain why you would like to join.\n\nBegin "Dear Sir or Madam,".`,
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'medium',
  },
  {
    id: 'let-009',
    type: 'task1_letter',
    category: 'general',
    title: 'Hotel complaint',
    body: `You recently stayed at a hotel and were unhappy with your stay.\n\nWrite a letter to the hotel manager. In your letter:\n• give details of your stay\n• explain what went wrong\n• say what you would like the manager to do.\n\nBegin "Dear Sir or Madam,".`,
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'medium',
  },
  {
    id: 'let-010',
    type: 'task1_letter',
    category: 'general',
    title: 'Suggest a meet-up',
    body: `You haven't seen an old friend for a long time.\n\nWrite a letter to them. In your letter:\n• explain what you have been doing recently\n• ask about their life\n• suggest a time and place to meet.\n\nBegin "Dear ...,".`,
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'easy',
  },

  // ── Task 1 · Chart / Process descriptions ──────────────────────────────────
  {
    id: 'chr-001',
    type: 'task1_chart',
    category: 'general',
    title: 'Smartphone ownership by age',
    body: 'The bar chart below shows the percentage of people in five age groups who owned a smartphone in 2010 and in 2020 in your country.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\n(Imagine the chart — describe two time points across five age groups.)',
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'medium',
    hint: 'Use overview + comparisons. "rose sharply", "remained stable" ...',
  },
  {
    id: 'chr-002',
    type: 'task1_chart',
    category: 'environment',
    title: 'CO₂ emissions in four countries',
    body: 'The line graph below illustrates CO₂ emissions per person in four countries between 1990 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\n(Imagine the trends — describe the overall pattern and key comparisons.)',
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'medium',
  },
  {
    id: 'chr-003',
    type: 'task1_chart',
    category: 'transport',
    title: 'How people commute',
    body: 'The pie charts below show the proportions of different ways people travelled to work in a European city in 2000 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'easy',
  },
  {
    id: 'chr-004',
    type: 'task1_chart',
    category: 'general',
    title: 'How to make bread (process)',
    body: 'The diagram below shows the process of making bread at home.\n\nSummarise the information by selecting and reporting the main features.\n\n(Imagine the stages and describe them in order, using the passive voice where appropriate.)',
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'medium',
    hint: 'Use sequence connectors: first, then, after that, finally.',
  },
  {
    id: 'chr-005',
    type: 'task1_chart',
    category: 'education',
    title: 'Students by subject area',
    body: 'The bar chart below shows the number of students enrolled in five subject areas at a university over a 10-year period.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'medium',
  },
  {
    id: 'chr-006',
    type: 'task1_chart',
    category: 'health',
    title: 'Daily exercise habits',
    body: 'The table below shows the average minutes of daily exercise reported by men and women in three age groups in 2015 and 2025.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'medium',
  },
  {
    id: 'chr-007',
    type: 'task1_chart',
    category: 'work',
    title: 'Job sector growth',
    body: 'The line graph below shows the percentage of workers employed in three sectors — agriculture, manufacturing and services — in a country between 1970 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'hard',
  },
  {
    id: 'chr-008',
    type: 'task1_chart',
    category: 'media',
    title: 'How people get news',
    body: 'The bar chart below shows the percentage of adults using four different sources to get the news (TV, radio, print and online) in 2005 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    targetWords: 150,
    suggestedMinutes: 20,
    difficulty: 'medium',
  },

  // ── Free writing prompts ───────────────────────────────────────────────────
  {
    id: 'fre-001',
    type: 'free',
    category: 'general',
    title: 'A memorable day',
    body: 'Write about a day in your life that you will never forget. What happened, who was there, and how did it change you?',
    targetWords: 200,
    suggestedMinutes: 25,
    difficulty: 'easy',
  },
  {
    id: 'fre-002',
    type: 'free',
    category: 'general',
    title: 'Letter to your future self',
    body: 'Write a letter to yourself ten years from now. What do you hope to have accomplished? What advice would you give your future self?',
    targetWords: 200,
    suggestedMinutes: 25,
    difficulty: 'easy',
  },
  {
    id: 'fre-003',
    type: 'free',
    category: 'culture',
    title: 'A book that changed you',
    body: 'Describe a book, film or piece of art that influenced how you see the world. Be specific about what changed in your thinking.',
    targetWords: 200,
    suggestedMinutes: 25,
    difficulty: 'medium',
  },
  {
    id: 'fre-004',
    type: 'free',
    category: 'travel',
    title: 'A place you love',
    body: 'Describe a place you love spending time in. Use sensory details — what you see, hear, smell, feel — to bring the place to life.',
    targetWords: 200,
    suggestedMinutes: 25,
    difficulty: 'easy',
  },
  {
    id: 'fre-005',
    type: 'free',
    category: 'general',
    title: 'A skill worth learning',
    body: 'Write about a skill you would like to learn in the next year. Why this skill, and how do you plan to learn it?',
    targetWords: 200,
    suggestedMinutes: 25,
    difficulty: 'easy',
  },
  {
    id: 'fre-006',
    type: 'free',
    category: 'general',
    title: 'A difficult decision',
    body: 'Describe a difficult decision you had to make. What were your options, how did you choose, and what happened afterwards?',
    targetWords: 200,
    suggestedMinutes: 25,
    difficulty: 'medium',
  },
  {
    id: 'fre-007',
    type: 'free',
    category: 'general',
    title: 'Free writing — open',
    body: 'Write about whatever is on your mind today. Don\'t worry about grammar or structure — just keep writing in English.',
    targetWords: 150,
    suggestedMinutes: 15,
    difficulty: 'easy',
    hint: 'Goal: build fluency. Don\'t stop, don\'t edit, just write.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getPromptById(id: string): WritingPrompt | null {
  return WRITING_PROMPTS.find((p) => p.id === id) ?? null
}

export function listPromptsByType(type: PromptType): WritingPrompt[] {
  return WRITING_PROMPTS.filter((p) => p.type === type)
}

export function searchPrompts(query: string): WritingPrompt[] {
  const q = query.trim().toLowerCase()
  if (!q) return WRITING_PROMPTS
  return WRITING_PROMPTS.filter((p) => {
    return (
      p.title.toLowerCase().includes(q) ||
      p.body.toLowerCase().includes(q) ||
      PROMPT_CATEGORY_LABELS[p.category].toLowerCase().includes(q)
    )
  })
}

export function getRandomPrompt(type?: PromptType): WritingPrompt {
  const pool = type ? listPromptsByType(type) : WRITING_PROMPTS
  const i = Math.floor(Math.random() * pool.length)
  return pool[i]
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}
