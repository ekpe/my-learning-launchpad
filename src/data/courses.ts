import { Course } from '../types';

export const courses: Course[] = [
  {
    id: "ai-strategy-leaders",
    title: "AI Strategy for Leaders",
    subtitle: "From Generative AI to the Agentic Enterprise",
    description: "A practical 90-minute introduction to AI leadership. Understand the AI shift, identify valuable opportunities, lead responsible adoption, and build your first 90-day AI action plan.",
    cardDescription: "A practical 90-minute introduction to AI leadership. Understand the AI shift, discover where AI creates value, learn how to lead responsible adoption, and build your first 90-day AI action plan.",
    duration: "90 minutes total",
    format: "Self-paced · 6 focused modules",
    audience: "Leaders, managers, entrepreneurs, educators, public-sector professionals, and aspiring AI leaders.",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
    isFree: true,
    order: 1,
    trackLabel: "AI Leadership Foundations",
    // Structure version 2 = the 90-minute redesign. Version 1 (7 modules, ~5 hours) is archived in docs/archive.
    curriculumVersion: 2,
    // Changes reach learners only via draft -> readiness check -> explicit publish (see api/_lib/course-publication.ts)
    launchGate: true,
    // Durations are design targets until the final recordings and activities are validated.
    durationStatus: "planned",
    fullDescription: "Artificial intelligence is changing how organizations work, make decisions, and create value. But effective AI leadership requires more than familiarity with the latest tools.\n\nIn this free, 90-minute self-paced course, Professor Ekpe Okorafor introduces six essential leadership decisions for navigating the transition from generative AI to increasingly agentic systems.\n\nYou'll learn what AI can do, where it can create meaningful value, how to redesign work around humans and AI, what responsible oversight requires, and how to turn an opportunity into a practical 90-day action plan.\n\nThrough six focused modules and one cumulative learning activity, you'll apply the concepts to a real workflow or challenge relevant to your organization.\n\nNo coding or prior AI expertise is required.",
    learningObjectives: [
      "Explain the shift from traditional and generative AI toward agentic AI.",
      "Distinguish AI capability from reliability and delegated authority.",
      "Identify a practical AI opportunity within an organization.",
      "Decide which activities should be performed by humans and AI.",
      "Recognize essential governance, oversight, and accountability requirements.",
      "Outline a practical 90-day AI leadership action plan."
    ],
    outcomes: [
      "Explain the shift from traditional and generative AI toward agentic AI.",
      "Distinguish AI capability from reliability and delegated authority.",
      "Identify a practical AI opportunity within an organization.",
      "Decide which activities should be performed by humans and AI.",
      "Recognize essential governance, oversight, and accountability requirements.",
      "Outline a practical 90-day AI leadership action plan."
    ],
    benefits: [
      "Six focused modules",
      "90 minutes total",
      "Self-paced learning",
      "Practical leadership frameworks",
      "One cumulative AI Leadership Action Card",
      "No technical background required"
    ],
    nextStepCourseIds: ["ai-strategy-intensive", "ai-strategy-certification", "enterprise-ai-implementation", "leading-agentic-ai"],
    // Deeper material from the original course. Listed so it is not lost, but NOT published or linked until
    // an actual asset exists (available: true AND a url). None are available yet.
    optionalResources: [
      { title: "AI Leadership Self-Assessment", available: false },
      { title: "Extended AI Capability Ladder examples", available: false },
      { title: "Copilots, Assistants, Agents and Multi-Agent Systems", available: false },
      { title: "AI Opportunity Matrix™ (detailed)", available: false },
      { title: "Human + AI Workflow Canvas™", available: false },
      { title: "AI Governance Checklist", available: false },
      { title: "Enterprise AI Readiness Assessment", available: false },
      { title: "Comprehensive 90-Day AI Leadership Action Plan", available: false }
    ],
    curriculum: [
      {
        module: "The AI Shift: From Automation to Intelligence",
        phase: "Understand",
        topics: [
          { id: "m1-l1", title: "Lesson 1.1 — Why This AI Moment Is Different", kind: "lesson", plannedMinutes: 4, description: "Introduces the shift from traditional predictive AI to generative and increasingly agentic systems, and why that shift matters for leadership decisions rather than technical history.", videoUrl: "" },
          { id: "m1-l2", title: "Lesson 1.2 — The AI Capability Ladder™", kind: "lesson", plannedMinutes: 4, description: "Predict → Generate → Assist → Act → Collaborate → Orchestrate. As capability rises, the questions leaders must ask change. Technical capability is never automatic permission to act.", videoUrl: "" },
          { id: "m1-l3", title: "Lesson 1.3 — What AI Can—and Cannot—Do", kind: "lesson", plannedMinutes: 4, description: "Separates Capability → Reliability → Authority, and explains why human judgment and accountability remain important.", videoUrl: "" },
          { id: "m1-a", title: "Activity — My AI Leadership Starting Point", kind: "activity", plannedMinutes: 3, description: "Choose one real workflow or challenge in your organization and identify one AI capability that could help.", output: "Action Card Output 1: My chosen workflow and the AI capability that could improve it." }
        ]
      },
      {
        module: "From Generative AI to Agentic AI",
        phase: "Anticipate",
        topics: [
          { id: "m2-l1", title: "Lesson 2.1 — From Generative AI to Agentic AI", kind: "lesson", plannedMinutes: 4, description: "Generative AI produces something. Agentic AI pursues something. One accessible organizational example shows the difference.", videoUrl: "" },
          { id: "m2-l2", title: "Lesson 2.2 — The AI Autonomy Spectrum™", kind: "lesson", plannedMinutes: 5, description: "Human Does → AI Assists → AI Recommends → AI Acts with Approval → AI Acts with Oversight → AI Acts Autonomously. The spectrum is not a maturity model: the right position depends on the task, its reliability, the consequence of error and the controls available. Appropriate autonomy, not maximum autonomy, is the goal.", videoUrl: "" },
          { id: "m2-l3", title: "Lesson 2.3 — Oversight, Command and Accountability", kind: "lesson", plannedMinutes: 3, description: "The practical difference between human-in-the-loop, human-on-the-loop and human-in-command, and why operational autonomy does not remove human accountability.", videoUrl: "" },
          { id: "m2-a", title: "Activity — My Delegation Decision", kind: "activity", plannedMinutes: 3, description: "For your workflow, identify its current autonomy position, an appropriate target position, and one reason not to delegate further.", output: "Action Card Output 2: My appropriate AI autonomy decision." }
        ]
      },
      {
        module: "Finding the Value: Where Should We Apply AI?",
        phase: "Identify",
        topics: [
          { id: "m3-l1", title: "Lesson 3.1 — Start with the Problem, Not the Technology", kind: "lesson", plannedMinutes: 4, description: "Valuable AI opportunities begin with organizational needs, bottlenecks and desired outcomes, not with a tool.", videoUrl: "" },
          { id: "m3-l2", title: "Lesson 3.2 — The AI Value Map™", kind: "lesson", plannedMinutes: 4, description: "Productivity → Experience → Growth → Transformation, illustrated with an accessible cross-sector example.", videoUrl: "" },
          { id: "m3-l3", title: "Lesson 3.3 — Choose One High-Value Workflow", kind: "lesson", plannedMinutes: 4, description: "A practical way to make an initial choice using value, feasibility, risk and strategic fit. The AI Opportunity Matrix™ is an optional deeper tool; detailed scoring is not required.", videoUrl: "" },
          { id: "m3-a", title: "Activity — My Priority Opportunity", kind: "activity", plannedMinutes: 3, description: "Identify the main problem your selected workflow should solve and one expected outcome.", output: "Action Card Output 3: The opportunity, why it matters, and the result I want to improve." }
        ]
      },
      {
        module: "Redesigning Work for Humans + AI",
        phase: "Redesign",
        topics: [
          { id: "m4-l1", title: "Lesson 4.1 — Don't Automate a Bad Process", kind: "lesson", plannedMinutes: 4, description: "Why AI should not simply be layered onto an inefficient workflow, and why simplification comes before automation.", videoUrl: "" },
          { id: "m4-l2", title: "Lesson 4.2 — Human + AI Comparative Advantage", kind: "lesson", plannedMinutes: 4, description: "Where AI can assist, and where human judgment, responsibility and intervention remain essential.", videoUrl: "" },
          { id: "m4-l3", title: "Lesson 4.3 — Redesign One Workflow", kind: "lesson", plannedMinutes: 4, description: "A simple before-and-after workflow showing what AI assists with, what it recommends, what it may execute, and what humans decide or approve.", videoUrl: "" },
          { id: "m4-a", title: "Activity — My Human + AI Workflow", kind: "activity", plannedMinutes: 3, description: "Define one change to your selected workflow and one important human decision point.", output: "Action Card Output 4: My proposed human + AI workflow improvement." }
        ]
      },
      {
        module: "Governing AI: Trust, Risk and Responsible Autonomy",
        phase: "Govern",
        topics: [
          { id: "m5-l1", title: "Lesson 5.1 — Why Autonomy Changes the Risk", kind: "lesson", plannedMinutes: 3, description: "Systems that can act need different controls from systems that only generate recommendations.", videoUrl: "" },
          { id: "m5-l2", title: "Lesson 5.2 — The AI Trust Stack™", kind: "lesson", plannedMinutes: 4, description: "Reliability → Safety → Security → Privacy → Transparency → Accountability, taught as practical leadership questions rather than a technical compliance checklist.", videoUrl: "" },
          { id: "m5-l3", title: "Lesson 5.3 — Who Is Accountable?", kind: "lesson", plannedMinutes: 3, description: "Human oversight, approval gates, monitoring, intervention and clear ownership of outcomes.", videoUrl: "" },
          { id: "m5-a", title: "Activity — My Essential Safeguard", kind: "activity", plannedMinutes: 2, description: "Identify the most important risk or control for your selected workflow and who owns the decision.", output: "Action Card Output 5: My priority safeguard and accountable owner." }
        ]
      },
      {
        module: "From AI Ambition to Execution",
        phase: "Execute",
        topics: [
          { id: "m6-l1", title: "Lesson 6.1 — Why AI Pilots Don't Scale", kind: "lesson", plannedMinutes: 4, description: "The common causes of stalled AI initiatives: unclear business value, weak ownership, data or workflow readiness gaps, inadequate governance and missing success measures.", videoUrl: "" },
          { id: "m6-l2", title: "Lesson 6.2 — What Must Be Ready?", kind: "lesson", plannedMinutes: 4, description: "The six dimensions of the Enterprise AI Readiness Model™ — Strategy → Work → Data → Technology → People → Governance — used as a concise leadership diagnostic, not a full organizational assessment.", videoUrl: "" },
          { id: "m6-l3", title: "Lesson 6.3 — Your First 90 Days", kind: "lesson", plannedMinutes: 6, description: "Days 1–30: Discover and Design. Days 31–60: Pilot and Learn. Days 61–90: Measure and Decide. Emphasizes measurable outcomes and responsible experimentation.", videoUrl: "" },
          { id: "m6-a", title: "Final Activity — My 90-Day AI Leadership Action Card", kind: "activity", plannedMinutes: 4, description: "Complete the final section of your Action Card and leave with one practical page: your workflow, an AI capability, an autonomy decision, a high-value opportunity, a workflow improvement, an essential safeguard with its accountable owner, and three next actions across 90 days.", output: "Final deliverable: My AI Leadership Action Card." }
        ]
      }
    ],
    assignment: {
      heading: "Your Cumulative Activity",
      title: "My AI Leadership Action Card",
      description: "Choose one workflow, challenge or organizational process and build one practical page across the six modules, rather than six unrelated assignments. You finish with one workflow or challenge, one potential AI capability, one appropriate autonomy decision, one high-value opportunity, one proposed workflow improvement, one essential safeguard with its accountable owner, and three next actions across 90 days.",
      format: "One-page Action Card, built a little at a time across the six modules (about 18 minutes of activities in total)",
      outputs: [
        { module: "Module 1 — Understand", text: "My chosen workflow and the AI capability that could improve it." },
        { module: "Module 2 — Anticipate", text: "My appropriate AI autonomy decision." },
        { module: "Module 3 — Identify", text: "The opportunity, why it matters, and the result I want to improve." },
        { module: "Module 4 — Redesign", text: "My proposed human + AI workflow improvement." },
        { module: "Module 5 — Govern", text: "My priority safeguard and accountable owner." },
        { module: "Module 6 — Execute", text: "Three next actions across 90 days, completing the one-page card." }
      ]
    }
  },
  {
    id: "ai-strategy-intensive",
    title: "AI Strategy Intensive: From Clarity to Action",
    description: "A high-impact program designed to bridge the gap between AI theory and practical business execution.",
    duration: "2–3 weeks",
    format: "self-paced + 1 live session",
    audience: "Professionals, Managers, Emerging Leaders",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800",
    price: 199,
    isFree: false,
    order: 2,
    fullDescription: "AI Strategy Intensive: From Clarity to Action is a 2-3 week program that combines self-paced learning with a live strategy session. It is specifically designed for professionals and managers who need to move beyond AI buzzwords and start implementing real-world solutions. You will learn how to identify high-impact AI use cases, evaluate technical feasibility, and build a business case for AI adoption.",
    learningObjectives: [
      "Define a clear AI vision for your team or department",
      "Evaluate AI tools and platforms for business efficiency",
      "Design a pilot project with measurable KPIs",
      "Navigate the ethical and security challenges of AI",
      "Lead cross-functional teams through AI adoption"
    ],
    curriculum: [
      {
        module: "Module 1: AI Fundamentals & Business Value",
        topics: [
          { title: "The AI Landscape: Beyond the Hype", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Identifying High-Impact Use Cases", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" }
        ]
      },
      {
        module: "Module 2: Strategy & Implementation",
        topics: [
          { title: "Building Your AI Roadmap", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" },
          { title: "Live Session: Strategy Workshop", videoUrl: "" }
        ]
      }
    ]
  },
  {
    id: "ai-strategy-certification",
    title: "AI Strategy Certification: Designing Enterprise AI Roadmaps",
    description: "A deep-dive certification program on building robust, scalable AI roadmaps that align with long-term corporate strategy.",
    duration: "6 Weeks (Cohort-based)",
    audience: "Chief Strategy Officers, VPs, Directors",
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800",
    price: 499,
    isFree: false,
    order: 3,
    fullDescription: "Become a certified AI strategist. This intensive program equips you with the tools and frameworks needed to design and lead enterprise-wide AI transformations. You will work on real-world case studies and develop a comprehensive AI roadmap for your organization.",
    curriculum: [
      {
        module: "Module 1: Strategic Alignment",
        topics: [
          { title: "Aligning AI with Corporate Goals", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "The AI Maturity Model", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Stakeholder Management", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" }
        ]
      },
      {
        module: "Module 2: Roadmap Design",
        topics: [
          { title: "Phased Implementation Strategies", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Resource Allocation", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Risk Mitigation", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" }
        ]
      },
      {
        module: "Module 3: Governance and Ethics",
        topics: [
          { title: "AI Governance Frameworks", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Responsible AI Principles", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Compliance and Regulation", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" }
        ]
      }
    ]
  },
  {
    id: "enterprise-ai-implementation",
    title: "Enterprise AI Implementation: From Strategy to Scalable Solutions",
    description: "Master the operational complexities of deploying AI at scale, from data governance to infrastructure and change management.",
    duration: "8 Weeks (Hybrid)",
    audience: "COOs, CTOs, Implementation Leads",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800",
    price: 799,
    isFree: false,
    order: 4,
    fullDescription: "Bridging the gap between strategy and execution. This course focuses on the operational realities of AI implementation. We cover data infrastructure, model deployment, monitoring, and the critical human element of AI adoption.",
    curriculum: [
      {
        module: "Module 1: Data and Infrastructure",
        topics: [
          { title: "Data Readiness for AI", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Cloud vs. On-Premise Solutions", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Scalable AI Architectures", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" }
        ]
      },
      {
        module: "Module 2: Operationalizing AI",
        topics: [
          { title: "Model Deployment and Monitoring", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "MLOps Principles", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Integrating AI into Existing Workflows", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" }
        ]
      },
      {
        module: "Module 3: Scaling Impact",
        topics: [
          { title: "Building AI Teams", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Continuous Improvement and Learning", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Scaling AI Across the Organization", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" }
        ]
      }
    ]
  },
  {
    id: "leading-agentic-ai",
    title: "Leading in the Age of Agentic AI: The Future of Autonomous Enterprises",
    description: "Prepare for the shift from assistive to autonomous AI agents and learn how to lead organizations in a multi-agent future.",
    duration: "4 Weeks (Intensive)",
    audience: "Forward-thinking CEOs, Innovation Leaders",
    image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800",
    price: 999,
    isFree: false,
    order: 5,
    fullDescription: "The next frontier of AI is agentic. This course explores the transition from AI as a tool to AI as an autonomous agent. We discuss the strategic implications of multi-agent systems, autonomous workflows, and the evolving role of human leadership in an agentic world.",
    curriculum: [
      {
        module: "Module 1: Understanding Agentic AI",
        topics: [
          { title: "Defining Autonomous Agents", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Agent Architectures and Capabilities", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "The Shift from Tools to Agents", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" }
        ]
      },
      {
        module: "Module 2: Strategic Implications",
        topics: [
          { title: "Autonomous Business Processes", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Multi-Agent Systems and Collaboration", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "New Business Models", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" }
        ]
      },
      {
        module: "Module 3: Leadership in the Agentic Era",
        topics: [
          { title: "Evolving Role of the CEO", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Human-Agent Collaboration", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Ethical and Societal Impacts", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" }
        ]
      }
    ]
  }
];
