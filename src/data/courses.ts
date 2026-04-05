import { Course } from '../types';

export const courses: Course[] = [
  {
    id: "ai-strategy-leaders",
    title: "AI Strategy for Leaders and Decision Makers",
    description: "A practical, executive-focused course designed to equip business leaders with the knowledge to leverage AI for transformation.",
    duration: "5–6 hours (Self-paced)",
    audience: "Business Leaders, Senior Managers, Decision Makers",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
    isFree: true,
    order: 1,
    fullDescription: "AI Strategy for Leaders and Decision Makers is a practical, executive-focused course designed to equip business leaders, senior managers, and decision-makers with the knowledge and frameworks needed to successfully leverage Artificial Intelligence for organizational transformation. Rather than focusing on technical details, this course emphasizes strategic understanding, real-world applications, governance considerations, and implementation roadmaps, enabling leaders to make informed AI investment decisions and drive measurable business value.",
    learningObjectives: [
      "Understand AI capabilities, limitations, and business impact",
      "Identify high-value AI opportunities within their organizations",
      "Develop a practical AI strategy aligned with business goals",
      "Evaluate risks, governance, and ethical considerations",
      "Build an actionable AI adoption roadmap",
      "Lead AI-driven digital transformation initiatives"
    ],
    curriculum: [
      {
        module: "Module 1: Understanding AI in the Business Context",
        topics: [
          { title: "Lesson 1.1 — What is AI and Why It Matters to Leaders", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Lesson 1.2 — Types of AI: Traditional, Machine Learning, and Generative AI", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Lesson 1.3 — AI Capabilities vs. Limitations", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" },
          { title: "Lesson 1.4 — The Current AI Landscape and Industry Trends", videoUrl: "https://www.youtube.com/watch?v=mO-u7_S5S6A" },
          { title: "Lesson 1.5 — Real-World Business Use Cases", videoUrl: "https://www.youtube.com/watch?v=2ePf9rue1Ao" }
        ]
      },
      {
        module: "Module 2: Identifying AI Opportunities",
        topics: [
          { title: "Lesson 2.1 — Where AI Creates Business Value", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Lesson 2.2 — AI Use Case Discovery Framework", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Lesson 2.3 — Prioritizing AI Initiatives", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" },
          { title: "Lesson 2.4 — Cost vs Impact Analysis", videoUrl: "https://www.youtube.com/watch?v=mO-u7_S5S6A" },
          { title: "Lesson 2.5 — Common AI Adoption Pitfalls", videoUrl: "https://www.youtube.com/watch?v=2ePf9rue1Ao" }
        ]
      },
      {
        module: "Module 3: Building an AI Strategy and Roadmap",
        topics: [
          { title: "Lesson 3.1 — Components of an AI Strategy", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Lesson 3.2 — Aligning AI with Business Objectives", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Lesson 3.3 — AI Readiness Assessment", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" },
          { title: "Lesson 3.4 — Creating an AI Implementation Roadmap", videoUrl: "https://www.youtube.com/watch?v=mO-u7_S5S6A" },
          { title: "Lesson 3.5 — Measuring AI ROI and Success Metrics", videoUrl: "https://www.youtube.com/watch?v=2ePf9rue1Ao" }
        ]
      },
      {
        module: "Module 4: AI Governance, Risk, and Ethics",
        topics: [
          { title: "Lesson 4.1 — AI Governance Frameworks", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Lesson 4.2 — Managing Data and Privacy Risks", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Lesson 4.3 — Ethical Considerations in AI", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" },
          { title: "Lesson 4.4 — Regulatory and Compliance Landscape", videoUrl: "https://www.youtube.com/watch?v=mO-u7_S5S6A" },
          { title: "Lesson 4.5 — Responsible AI Implementation", videoUrl: "https://www.youtube.com/watch?v=2ePf9rue1Ao" }
        ]
      },
      {
        module: "Module 5: Leading AI Transformation",
        topics: [
          { title: "Lesson 5.1 — Organizational Change Management for AI", videoUrl: "https://www.youtube.com/watch?v=ad79nYk2keg" },
          { title: "Lesson 5.2 — Building AI-Ready Teams", videoUrl: "https://www.youtube.com/watch?v=5ka_vY_N-S4" },
          { title: "Lesson 5.3 — AI Investment and Budgeting", videoUrl: "https://www.youtube.com/watch?v=R9OHn5ZF4Uo" },
          { title: "Lesson 5.4 — Vendor Selection and Build vs Buy Decisions", videoUrl: "https://www.youtube.com/watch?v=mO-u7_S5S6A" },
          { title: "Lesson 5.5 — Future Trends: Agentic AI and Autonomous Systems", videoUrl: "https://www.youtube.com/watch?v=2ePf9rue1Ao" }
        ],
        quiz: {
          id: "module_5_quiz",
          title: "Leading AI Transformation Quiz",
          questions: [
            {
              id: "q1",
              question: "What is a key component of organizational change management for AI?",
              options: [
                "Ignoring employee concerns",
                "Building an AI-ready culture and continuous learning",
                "Keeping AI projects secret",
                "Replacing all human staff immediately"
              ],
              correctAnswer: 1
            },
            {
              id: "q2",
              question: "Which factor is critical when making a 'Build vs Buy' decision for AI solutions?",
              options: [
                "Always choosing the cheapest option",
                "Strategic importance and internal technical capabilities",
                "Flipping a coin",
                "Following what competitors do without analysis"
              ],
              correctAnswer: 1
            }
          ]
        }
      }
    ],
    assignment: {
      title: "Develop an AI Strategy Roadmap for Your Organization",
      description: "Create a high-level AI strategy roadmap tailored to your organization, including 3–5 AI opportunities, business value justification, readiness assessment, implementation priorities, and risk considerations.",
      format: "5–10 slide presentation OR 2–3 page executive strategy brief"
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
