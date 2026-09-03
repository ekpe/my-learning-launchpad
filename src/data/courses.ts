import { Course } from '../types';

export const courses: Course[] = [
  {
    id: "ai-strategy-leaders",
    title: "AI Strategy for Leaders",
    description: "From Generative AI to the Agentic Enterprise — a practical foundation for AI leadership. Learn where AI creates value, how to redesign work for humans and AI together, how to govern autonomy responsibly, and how to move from experimentation to execution.",
    duration: "Approximately 5 hours (Self-paced)",
    format: "Self-paced online short course",
    audience: "Executives, business leaders, managers, consultants, technology leaders, transformation professionals, entrepreneurs, and aspiring AI leaders",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
    isFree: true,
    order: 1,
    fullDescription: "AI leadership is no longer primarily about understanding what artificial intelligence can do. It is about deciding where AI should create value, which workflows should be redesigned, what decisions can be delegated, where humans must remain accountable, how AI should be governed, and how organizations move from experimentation to execution. This course provides leaders with a practical foundation for answering those questions. Rather than teaching a particular AI product, it develops the strategic frameworks required to lead organizations through the transition from generative AI toward increasingly agentic, AI-native ways of working. The competitive advantage from AI will not come simply from having access to better models — it will come from redesigning work, decisions, and organizations around what humans and intelligent systems can accomplish together. Every learner receives the AI Strategy for Leaders Toolkit — ten practical frameworks including the AI Capability Ladder, the Autonomy Spectrum, the AI Opportunity Matrix, and the Human + AI Workflow Canvas — plus a MyLearningLaunchpad Certificate of Completion.",
    learningObjectives: [
      "Explain the evolution from traditional AI through generative AI to agentic AI",
      "Distinguish AI assistants, copilots, agents, agentic workflows, and multi-agent systems",
      "Explain AI opportunities and limitations in business language, not just technical language",
      "Identify high-value AI opportunities within business processes and workflows",
      "Evaluate AI initiatives using business value, feasibility, risk, and strategic importance",
      "Determine appropriate roles for humans and AI within redesigned workflows",
      "Understand how increasing AI autonomy requires increasing governance",
      "Recognize the organizational, workforce, data, technology, and governance capabilities enterprise AI requires",
      "Avoid the common mistakes that trap AI initiatives in endless experimentation",
      "Develop a practical 90-Day AI Leadership Action Plan for your organization, team, or role"
    ],
    curriculum: [
      {
        module: "Module 1: The AI Shift — From Automation to Intelligence",
        topics: [
          {
            title: "Lesson 1.1 — Why This AI Moment Is Different",
            description: "AI didn't begin with ChatGPT. This lesson traces the shift from traditional AI and predictive systems to generative, multimodal, reasoning-capable foundation models — and why declining barriers to adoption mean AI is becoming a general-purpose capability across knowledge work.",
            videoUrl: ""
          },
          {
            title: "Lesson 1.2 — The AI Capability Ladder™",
            description: "Introduces MyLearningLaunchpad's signature framework — Predict → Generate → Assist → Act → Collaborate → Orchestrate — showing how the leadership challenge shifts from technology adoption to delegation, governance, and organizational design as AI climbs the ladder.",
            videoUrl: ""
          },
          {
            title: "Lesson 1.3 — What AI Can—and Cannot—Do",
            description: "A clear-eyed look at AI's real strengths (pattern recognition, generation, synthesis, reasoning, tool use) and real limits (hallucination, reliability, context, judgment, accountability) — the foundation for sound strategic decisions.",
            videoUrl: ""
          },
          {
            title: "Module 1 Activity — AI Leadership Self-Assessment",
            description: "Score yourself and your organization across AI understanding, adoption, sponsorship, data readiness, workforce readiness, governance, workflow redesign, and measurement. This baseline carries through the rest of the course.",
            videoUrl: ""
          }
        ]
      },
      {
        module: "Module 2: From Generative AI to Agentic AI",
        topics: [
          {
            title: "Lesson 2.1 — Generative AI vs. Agentic AI",
            description: "Generative AI runs Prompt → Generate → Respond. Agentic AI runs Goal → Plan → Act → Observe → Evaluate → Adapt. This lesson unpacks the goals, planning, tools, memory, and autonomy that separate the two — and why the difference matters for leaders.",
            videoUrl: ""
          },
          {
            title: "Lesson 2.2 — Copilots, Assistants and Agents",
            description: "A practical taxonomy — Assistant, Copilot, Agent, Agentic Workflow, Multi-Agent System — built around one leadership question: what authority are we actually giving the system?",
            videoUrl: ""
          },
          {
            title: "Lesson 2.3 — The Autonomy Spectrum",
            description: "Introduces the AI Autonomy Spectrum™ — from Human Does to AI Acts Autonomously — and the core principle that autonomy should be earned, not assumed, through evidence of reliability, controls, and trust.",
            videoUrl: ""
          },
          {
            title: "Lesson 2.4 — The Emerging Agentic Enterprise",
            description: "Explores how agentic systems could reshape customer service, finance, HR, IT, software development, supply chains, sales, and more — and why agentic AI shouldn't just be layered onto inefficient processes.",
            videoUrl: ""
          },
          {
            title: "Module 2 Activity — The Delegation Exercise",
            description: "Choose one recurring workflow and decide what should remain human, what AI could assist with, what AI could execute, and what should never be delegated without approval.",
            videoUrl: ""
          }
        ]
      },
      {
        module: "Module 3: Finding the Value — Where Should We Apply AI?",
        topics: [
          {
            title: "Lesson 3.1 — Stop Starting With the Technology",
            description: "Reframes the wrong question ('Where can we use AI?') into the right one: where is valuable work constrained by time, cost, complexity, information, or human capacity? Start with business problems, not AI capabilities.",
            videoUrl: ""
          },
          {
            title: "Lesson 3.2 — The AI Value Map™",
            description: "Four value domains — Productivity, Experience, Growth, and Transformation — give leaders a shared language for mapping where AI opportunities actually create value.",
            videoUrl: ""
          },
          {
            title: "Lesson 3.3 — Think Workflow, Not Use Case",
            description: "Moves from isolated tasks ('summarize documents') to full workflow redesign, teaching leaders to identify triggers, inputs, decisions, actions, systems, bottlenecks, and exceptions across a process.",
            videoUrl: ""
          },
          {
            title: "Lesson 3.4 — Prioritizing AI Opportunities",
            description: "Introduces the AI Opportunity Matrix™ — scoring potential initiatives on business value, feasibility, risk, and strategic fit — to move beyond random experimentation toward systematic prioritization.",
            videoUrl: ""
          },
          {
            title: "Module 3 Activity — Find Your Top Three AI Opportunities",
            description: "Identify 5–10 opportunities, score them with the AI Opportunity Matrix, and select one priority workflow — this becomes the subject of your capstone.",
            videoUrl: ""
          }
        ]
      },
      {
        module: "Module 4: Redesigning Work for Humans + AI",
        topics: [
          {
            title: "Lesson 4.1 — Don't Automate a Bad Process",
            description: "Why organizations default to Digitize → Automate → Add AI without questioning the underlying process — and the better path: Understand → Eliminate → Simplify → Redesign → Augment → Automate.",
            videoUrl: ""
          },
          {
            title: "Lesson 4.2 — Human + AI Comparative Advantage",
            description: "AI excels at scale, speed, pattern recognition, and synthesis. Humans remain essential for accountability, ethical judgment, empathy, and strategic judgment. The goal isn't Human OR AI — it's Human × AI.",
            videoUrl: ""
          },
          {
            title: "Lesson 4.3 — The Human-Agent Operating Model™",
            description: "Four roles for redesigned work — AI Executes, AI Recommends, Human Decides, Human Governs — give leaders a shared vocabulary for allocating work between people and systems.",
            videoUrl: ""
          },
          {
            title: "Lesson 4.4 — Redesigning the Workflow",
            description: "Take a real workflow from its 'before' state to an 'after' state built around human-in-the-loop and human-on-the-loop patterns, exception-based intervention, escalation, and approval gates.",
            videoUrl: ""
          },
          {
            title: "Module 4 Activity — Human + AI Workflow Canvas™",
            description: "Redesign your selected workflow end-to-end: objective, trigger, human and AI roles, tools/data, decision points, approval gates, exceptions, escalation paths, and success metrics. One of the course's principal artifacts.",
            videoUrl: ""
          }
        ]
      },
      {
        module: "Module 5: Governing AI — Trust, Risk and Responsible Autonomy",
        topics: [
          {
            title: "Lesson 5.1 — The New Risk Equation",
            description: "Capability ↑ + Autonomy ↑ = Governance ↑. As systems gain the ability to act, organizations must strengthen identity, permissions, monitoring, testing, auditability, and accountability.",
            videoUrl: ""
          },
          {
            title: "Lesson 5.2 — The AI Trust Stack™",
            description: "Six dimensions of trustworthy AI — Reliability, Safety, Security, Privacy, Transparency, Accountability — give leaders a checklist for evaluating any AI system before it's given more authority.",
            videoUrl: ""
          },
          {
            title: "Lesson 5.3 — Matching Governance to Autonomy",
            description: "Returns to the Autonomy Spectrum with one governing principle: govern the decision and the consequence, not merely the model. A marketing-copy assistant and a transaction-approving agent don't need the same controls.",
            videoUrl: ""
          },
          {
            title: "Lesson 5.4 — Responsible AI as a Leadership Responsibility",
            description: "Covers executive accountability, policy, risk ownership, AI governance bodies, model evaluation, data governance, workforce education, vendor considerations, and continuous monitoring.",
            videoUrl: ""
          },
          {
            title: "Module 5 Activity — AI Governance Checklist",
            description: "For your priority workflow: what can the AI access or change, what decisions can it make, what requires approval, what happens on failure, and who monitors, stops, and owns the outcome?",
            videoUrl: ""
          }
        ]
      },
      {
        module: "Module 6: From AI Ambition to Execution",
        topics: [
          {
            title: "Lesson 6.1 — Why AI Pilots Don't Scale",
            description: "The common failure modes — technology-first thinking, no business owner, weak business case, poor data, missing integration, inadequate governance, no measurement — that trap initiatives in endless experimentation.",
            videoUrl: ""
          },
          {
            title: "Lesson 6.2 — The Enterprise AI Readiness Model™",
            description: "Six dimensions — Strategy, Work, Data, Technology, People, Governance — each scored from Emerging to AI-Native, giving leaders a structured view of organizational readiness.",
            videoUrl: ""
          },
          {
            title: "Lesson 6.3 — Build, Buy or Partner?",
            description: "A decision framework for commercial products, enterprise platforms, custom solutions, open-source models, and partners — build where AI creates distinctive advantage, buy where it's increasingly commodity.",
            videoUrl: ""
          },
          {
            title: "Lesson 6.4 — Measuring AI Value",
            description: "Moves beyond 'did people use it?' to four measurement categories — Adoption, Performance, Operational Value, Strategic Value — that connect AI activity to business performance.",
            videoUrl: ""
          },
          {
            title: "Lesson 6.5 — The Path to the AI-Native Enterprise",
            description: "The maturity progression from Experiment through Augment, Integrate, Delegate, Orchestrate, to Reimagine. AI maturity is measured by how deeply intelligence changes how the organization creates value — not by how many tools it owns.",
            videoUrl: ""
          }
        ]
      },
      {
        module: "Capstone: Your 90-Day AI Leadership Action Plan",
        topics: [
          {
            title: "Part 1 — The Opportunity",
            description: "Define the business problem you're solving, why it matters, and what measurable outcome should improve.",
            videoUrl: ""
          },
          {
            title: "Part 2 — The Workflow",
            description: "Identify the workflow you'll redesign and where the current bottlenecks are.",
            videoUrl: ""
          },
          {
            title: "Part 3 — Human + AI",
            description: "Decide what AI should assist, recommend, or execute — and what humans must decide, approve, or govern.",
            videoUrl: ""
          },
          {
            title: "Part 4 — Governance",
            description: "Identify the major risks, the authority AI can have, and the controls and human gates required.",
            videoUrl: ""
          },
          {
            title: "Part 5 — Success Measures",
            description: "Define 3–5 measurable indicators of success.",
            videoUrl: ""
          },
          {
            title: "Part 6 — 90-Day Plan",
            description: "Days 1–30: Discover & Design. Days 31–60: Pilot & Learn. Days 61–90: Measure & Decide — stop, improve, expand, or scale.",
            videoUrl: ""
          }
        ]
      }
    ],
    assignment: {
      title: "Your 90-Day AI Leadership Action Plan",
      description: "Develop a one-page executive plan covering the opportunity, the workflow to redesign, human + AI roles, governance and risk, success measures, and a 90-day Discover & Design / Pilot & Learn / Measure & Decide roadmap.",
      format: "One-page executive plan (worksheet template provided in the AI Strategy for Leaders Toolkit)"
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
