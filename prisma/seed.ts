import { prisma } from "../lib/prisma";
import {
  Role,
  LeadSource,
  LeadStage,
  StudentStage,
  DocumentStatus,
  PaymentStatus,
  AgentChannel,
  AgentRole,
  AgentStatus,
  AGENT_ROLE_META,
  AGENT_TRIGGER_DEFAULT_SUGGESTIONS,
  ConversationOutcome,
} from "../types";
import bcrypt from "bcryptjs";


async function main() {
  console.log("🌱 Starting database seeding for Apex Technical & Vocational Academy...");

  // 1. Clean existing records to allow idempotent re-runs
  await prisma.auditLog.deleteMany();
  await prisma.agentTriggerFire.deleteMany();
  await prisma.agentTrigger.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.documentTemplate.deleteMany();
  await prisma.document.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // 2. Create Organization
  const organization = await prisma.organization.create({
    data: {
      name: "Apex Technical & Vocational Academy",
      slug: "apex-tech-academy",
    },
  });

  console.log(`✔ Created Organization: ${organization.name} (${organization.id})`);

  // 3. Create Team Members (Admin, Counselor, Readonly)
  const defaultPassword = await bcrypt.hash("Password123!", 10);

  const adminUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Rajesh Sharma",
      email: "admin@apextech.edu",
      password: defaultPassword,
      role: Role.ADMIN,
    },
  });

  const counselorUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Priya Nair",
      email: "counselor@apextech.edu",
      password: defaultPassword,
      role: Role.COUNSELOR,
    },
  });

  const readonlyUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Amit Verma",
      email: "viewer@apextech.edu",
      password: defaultPassword,
      role: Role.READONLY,
    },
  });

  console.log("✔ Created Team Members: Admin, Counselor, Read-Only");

  // 4. Create one AI Agent per functional role (13 total)
  // Partial: INBOUND_CALL_RECEIVER is deliberately left unseeded so the
  // "Available Agents" catalog on /agents always has at least one real entry.
  const roleAgentSeeds: Partial<Record<AgentRole, { name: string; config: Record<string, any> }>> = {
    LEAD_TELECALLER: {
      name: "Aarav - Inbound Voice Screener",
      config: {
        voiceModel: "elevenlabs-multilingual-v2",
        systemPromptVersion: "v2.1.0",
        script: "Greet vocational applicant, qualify eligibility, schedule campus demo.",
      },
    },
    WHATSAPP_NURTURE: {
      name: "Apex Admissions Assistant",
      config: {
        channelProvider: "meta-cloud-api",
        responseDelaySeconds: 2,
        brochureAutomations: true,
      },
    },
    EMAIL_NURTURE: {
      name: "Apex Email Drip Nurture",
      config: {
        espProvider: "sendgrid",
        sequenceLengthDays: 14,
        subjectLineTesting: true,
      },
    },
    COUNSELLOR: {
      name: "Website Live Guide",
      config: {
        placement: "bottom-right",
        theme: "apex-blue",
        faqEnabled: true,
      },
    },
    LEAD_QUALIFICATION: {
      name: "Priya AI - Qualification Caller",
      config: {
        voiceModel: "elevenlabs-multilingual-v2",
        script: "Score inbound leads on budget, eligibility, and intent before counselor handoff.",
      },
    },
    REENGAGEMENT: {
      name: "Cold Lead Win-Back Bot",
      config: {
        channelProvider: "meta-cloud-api",
        cadenceDays: [3, 7, 21],
      },
    },
    INTERVIEW_SCREENING: {
      name: "Rohit AI - Interview Scheduler",
      config: {
        voiceModel: "elevenlabs-multilingual-v2",
        script: "Confirm applicant availability and book technical screening slots.",
      },
    },
    DOCUMENT_COLLECTION: {
      name: "Document Chaser Bot",
      config: {
        channelProvider: "meta-cloud-api",
        reminderCadenceDays: 2,
      },
    },
    PAYMENT_REMINDER: {
      name: "Fee Reminder Bot",
      config: {
        channelProvider: "meta-cloud-api",
        reminderCadenceDays: 3,
        escalateAfterDays: 10,
      },
    },
    ONBOARDING: {
      name: "New Student Onboarding Sequence",
      config: {
        espProvider: "sendgrid",
        sequenceLengthDays: 7,
      },
    },
    SUPPORT_ESCALATION: {
      name: "Campus Support Line",
      config: {
        voiceModel: "elevenlabs-multilingual-v2",
        script: "Triage student support calls and escalate unresolved issues to staff.",
      },
    },
    FEEDBACK_NPS: {
      name: "Post-Cohort NPS Survey Bot",
      config: {
        espProvider: "sendgrid",
        surveyTrigger: "cohort_completion",
      },
    },
    ALUMNI_REFERRAL: {
      name: "Alumni Referral Outreach Bot",
      config: {
        channelProvider: "meta-cloud-api",
        referralIncentive: "INR 2000 per successful admission",
      },
    },
  };

  const createdAgents: Record<AgentRole, Awaited<ReturnType<typeof prisma.agent.create>>> =
    {} as any;

  for (const [role, seedData] of Object.entries(roleAgentSeeds) as [AgentRole, NonNullable<typeof roleAgentSeeds[AgentRole]>][]) {
    const meta = AGENT_ROLE_META[role];
    createdAgents[role] = await prisma.agent.create({
      data: {
        organizationId: organization.id,
        name: seedData.name,
        channel: meta.channel,
        role,
        category: meta.category,
        status: AgentStatus.LIVE,
        config: JSON.stringify({
          language: "en-IN",
          workingHours: "09:00 - 20:00 IST",
          scriptPromptVersion: "v1.0",
          ...seedData.config,
        }),
      },
    });
  }

  console.log(`✔ Created ${Object.keys(createdAgents).length} AI Agents (one per role)`);

  const voiceAgent = createdAgents.LEAD_TELECALLER;
  const whatsappAgent = createdAgents.WHATSAPP_NURTURE;
  const webChatAgent = createdAgents.COUNSELLOR;

  // 5. Seed 18 Realistic Leads
  const leadsData = [
    {
      name: "Rohan Kulkarni",
      phone: "+91 98201 23456",
      email: "rohan.kulkarni@gmail.com",
      source: LeadSource.META_ADS,
      stage: LeadStage.HOT,
      score: 88,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Sneha Patil",
      phone: "+91 98202 34567",
      email: "sneha.patil@outlook.com",
      source: LeadSource.WHATSAPP,
      stage: LeadStage.CONVERTING,
      score: 94,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Vikramaditya Rao",
      phone: "+91 98203 45678",
      email: "vikram.rao@yahoo.com",
      source: LeadSource.GOOGLE_ADS,
      stage: LeadStage.WARM,
      score: 65,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Ananya Iyer",
      phone: "+91 98204 56789",
      email: "ananya.iyer@gmail.com",
      source: LeadSource.WEBSITE_FORM,
      stage: LeadStage.COLD,
      score: 35,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Mohammed Farhan",
      phone: "+91 98205 67890",
      email: "farhan.m@hotmail.com",
      source: LeadSource.REFERRAL,
      stage: LeadStage.HOT,
      score: 91,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Kavita Reddy",
      phone: "+91 98206 78901",
      email: "kavita.reddy@gmail.com",
      source: LeadSource.CALL_TRACKING,
      stage: LeadStage.WARM,
      score: 72,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Manish Chawla",
      phone: "+91 98207 89012",
      email: "manish.c@gmail.com",
      source: LeadSource.CSV_IMPORT,
      stage: LeadStage.LOST,
      lostReason: "Fee budget mismatch; requested scholarship unavailable",
      score: 25,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Pooja Deshmukh",
      phone: "+91 98208 90123",
      email: "pooja.d@rediffmail.com",
      source: LeadSource.GOOGLE_SHEETS,
      stage: LeadStage.COLD,
      score: 40,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Arjun Nambiar",
      phone: "+91 98209 01234",
      email: "arjun.nambiar@gmail.com",
      source: LeadSource.META_ADS,
      stage: LeadStage.CONVERTING,
      score: 96,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Divya Chauhan",
      phone: "+91 98210 12345",
      email: "divya.chauhan@gmail.com",
      source: LeadSource.MANUAL,
      stage: LeadStage.HOT,
      score: 85,
      assignedToUserId: adminUser.id,
    },
    {
      name: "Deepak Mehra",
      phone: "+91 98211 23456",
      email: "deepak.mehra@yahoo.co.in",
      source: LeadSource.WEBSITE_FORM,
      stage: LeadStage.WARM,
      score: 68,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Shreya Sen",
      phone: "+91 98212 34567",
      email: "shreya.sen@gmail.com",
      source: LeadSource.GOOGLE_ADS,
      stage: LeadStage.LOST,
      lostReason: "Opted for degree college instead of vocational diploma",
      score: 30,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Aditya Bhat",
      phone: "+91 98213 45678",
      email: "aditya.bhat@gmail.com",
      source: LeadSource.WHATSAPP,
      stage: LeadStage.WARM,
      score: 75,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Tanvi Saxena",
      phone: "+91 98214 56789",
      email: "tanvi.s@gmail.com",
      source: LeadSource.REFERRAL,
      stage: LeadStage.HOT,
      score: 89,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Harish Pillai",
      phone: "+91 98215 67890",
      email: "harish.pillai@outlook.com",
      source: LeadSource.CALL_TRACKING,
      stage: LeadStage.COLD,
      score: 42,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Zoya Siddiqui",
      phone: "+91 98216 78901",
      email: "zoya.siddiqui@gmail.com",
      source: LeadSource.META_ADS,
      stage: LeadStage.CONVERTING,
      score: 93,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Gaurav Joshi",
      phone: "+91 98217 89012",
      email: "gaurav.joshi@gmail.com",
      source: LeadSource.CSV_IMPORT,
      stage: LeadStage.LOST,
      lostReason: "Relocated to another state before batch start",
      score: 20,
      assignedToUserId: counselorUser.id,
    },
    {
      name: "Neha Sundaram",
      phone: "+91 98218 90123",
      email: "neha.s@gmail.com",
      source: LeadSource.WEBSITE_FORM,
      stage: LeadStage.WARM,
      score: 64,
      assignedToUserId: counselorUser.id,
    },
  ];

  const createdLeads = [];
  for (const leadItem of leadsData) {
    const created = await prisma.lead.create({
      data: {
        organizationId: organization.id,
        ...leadItem,
      },
    });
    createdLeads.push(created);
  }

  console.log(`✔ Seeded ${createdLeads.length} Leads`);

  // 6. Seed 9 Realistic Students with Documents & Payments
  const studentsData = [
    {
      name: "Akash Verma",
      phone: "+91 98111 00001",
      email: "akash.verma@apexstudent.in",
      stage: StudentStage.ACTIVE,
      program: "Electric Vehicle (EV) Powertrain Maintenance",
      cohort: "2026-Q1",
      branch: "Pune Industrial Campus",
      leadId: createdLeads[0].id,
      documents: [
        { name: "Aadhaar Card", status: DocumentStatus.VERIFIED, fileUrl: "https://docs.apextech.edu/akash/aadhaar.pdf" },
        { name: "10th Certificate", status: DocumentStatus.VERIFIED, fileUrl: "https://docs.apextech.edu/akash/10th.pdf" },
        { name: "ITI Marks Card", status: DocumentStatus.RECEIVED, fileUrl: "https://docs.apextech.edu/akash/iti.pdf" },
      ],
      payments: [
        { amount: 15000, installmentNumber: 1, status: PaymentStatus.PAID, dueDate: new Date("2026-01-10") },
        { amount: 15000, installmentNumber: 2, status: PaymentStatus.PAID, dueDate: new Date("2026-02-10") },
        { amount: 15000, installmentNumber: 3, status: PaymentStatus.PENDING, dueDate: new Date("2026-03-25") },
      ],
    },
    {
      name: "Meera Krishnan",
      phone: "+91 98111 00002",
      email: "meera.k@apexstudent.in",
      stage: StudentStage.ACTIVE,
      program: "Full Stack Web Development",
      cohort: "2026-Q1",
      branch: "Bangalore Central",
      leadId: createdLeads[1].id,
      documents: [
        { name: "PAN Card", status: DocumentStatus.VERIFIED, fileUrl: "https://docs.apextech.edu/meera/pan.pdf" },
        { name: "Graduation Certificate", status: DocumentStatus.VERIFIED, fileUrl: "https://docs.apextech.edu/meera/degree.pdf" },
      ],
      payments: [
        { amount: 25000, installmentNumber: 1, status: PaymentStatus.PAID, dueDate: new Date("2026-01-15") },
        { amount: 25000, installmentNumber: 2, status: PaymentStatus.PAID, dueDate: new Date("2026-02-15") },
      ],
    },
    {
      name: "Siddharth Malhotra",
      phone: "+91 98111 00003",
      email: "sid.m@apexstudent.in",
      stage: StudentStage.ENROLLED,
      program: "Solar PV Installation & Energy Systems",
      cohort: "2026-Q2",
      branch: "Delhi NCR Hub",
      leadId: createdLeads[8].id,
      documents: [
        { name: "Aadhaar Card", status: DocumentStatus.VERIFIED, fileUrl: "https://docs.apextech.edu/sid/aadhaar.pdf" },
        { name: "Diploma Certificate", status: DocumentStatus.PENDING, fileUrl: null },
      ],
      payments: [
        { amount: 12000, installmentNumber: 1, status: PaymentStatus.PAID, dueDate: new Date("2026-02-28") },
        { amount: 12000, installmentNumber: 2, status: PaymentStatus.PENDING, dueDate: new Date("2026-04-01") },
      ],
    },
    {
      name: "Kritika Goswami",
      phone: "+91 98111 00004",
      email: "kritika.g@apexstudent.in",
      stage: StudentStage.ENROLLED,
      program: "CNC Precision Machining & Robotics",
      cohort: "2026-Q2",
      branch: "Pune Industrial Campus",
      leadId: createdLeads[15].id,
      documents: [
        { name: "Aadhaar Card", status: DocumentStatus.RECEIVED, fileUrl: "https://docs.apextech.edu/kritika/aadhaar.pdf" },
        { name: "Medical Fitness Certificate", status: DocumentStatus.PENDING, fileUrl: null },
      ],
      payments: [
        { amount: 18000, installmentNumber: 1, status: PaymentStatus.PAID, dueDate: new Date("2026-02-20") },
        { amount: 18000, installmentNumber: 2, status: PaymentStatus.OVERDUE, dueDate: new Date("2026-03-05") },
      ],
    },
    {
      name: "Rahul Tiwari",
      phone: "+91 98111 00005",
      email: "rahul.t@apexstudent.in",
      stage: StudentStage.ALUMNI,
      program: "Full Stack Web Development",
      cohort: "2025-Q3",
      branch: "Bangalore Central",
      leadId: null,
      documents: [
        { name: "Course Completion Certificate", status: DocumentStatus.VERIFIED, fileUrl: "https://docs.apextech.edu/rahul/cert.pdf" },
      ],
      payments: [
        { amount: 50000, installmentNumber: 1, status: PaymentStatus.PAID, dueDate: new Date("2025-07-01") },
      ],
    },
    {
      name: "Bhavna Patel",
      phone: "+91 98111 00006",
      email: "bhavna.patel@apexstudent.in",
      stage: StudentStage.ALUMNI,
      program: "HVAC & Commercial Refrigeration Technology",
      cohort: "2025-Q4",
      branch: "Pune Industrial Campus",
      leadId: null,
      documents: [
        { name: "Course Completion Certificate", status: DocumentStatus.VERIFIED, fileUrl: "https://docs.apextech.edu/bhavna/cert.pdf" },
      ],
      payments: [
        { amount: 35000, installmentNumber: 1, status: PaymentStatus.PAID, dueDate: new Date("2025-10-01") },
      ],
    },
    {
      name: "Tariq Anwer",
      phone: "+91 98111 00007",
      email: "tariq.a@apexstudent.in",
      stage: StudentStage.ACTIVE,
      program: "Digital Marketing & Performance Media",
      cohort: "2026-Q1",
      branch: "Delhi NCR Hub",
      leadId: null,
      documents: [
        { name: "Government ID", status: DocumentStatus.VERIFIED, fileUrl: "https://docs.apextech.edu/tariq/id.pdf" },
      ],
      payments: [
        { amount: 20000, installmentNumber: 1, status: PaymentStatus.PAID, dueDate: new Date("2026-01-05") },
        { amount: 20000, installmentNumber: 2, status: PaymentStatus.PAID, dueDate: new Date("2026-02-05") },
      ],
    },
    {
      name: "Rhea Banerjee",
      phone: "+91 98111 00008",
      email: "rhea.b@apexstudent.in",
      stage: StudentStage.ENQUIRY,
      program: "Solar PV Installation & Energy Systems",
      cohort: "2026-Q3",
      branch: "Bangalore Central",
      leadId: createdLeads[2].id,
      documents: [
        { name: "Registration Form", status: DocumentStatus.PENDING, fileUrl: null },
      ],
      payments: [
        { amount: 10000, installmentNumber: 1, status: PaymentStatus.PENDING, dueDate: new Date("2026-04-15") },
      ],
    },
    {
      name: "Jaspreet Singh",
      phone: "+91 98111 00009",
      email: "jaspreet.s@apexstudent.in",
      stage: StudentStage.ENQUIRY,
      program: "CNC Precision Machining & Robotics",
      cohort: "2026-Q3",
      branch: "Delhi NCR Hub",
      leadId: createdLeads[4].id,
      documents: [],
      payments: [
        { amount: 15000, installmentNumber: 1, status: PaymentStatus.PENDING, dueDate: new Date("2026-04-20") },
      ],
    },
  ];

  const createdStudents = [];
  for (const s of studentsData) {
    const { documents, payments, ...studentDetails } = s;
    const student = await prisma.student.create({
      data: {
        organizationId: organization.id,
        ...studentDetails,
        documents: {
          create: documents,
        },
        payments: {
          create: payments,
        },
      },
    });
    createdStudents.push(student);
  }

  console.log(`✔ Seeded ${createdStudents.length} Students with Documents & Payments`);

  // 6b. Seed Program Document Templates
  const programTemplates = [
    {
      program: "Electric Vehicle (EV) Powertrain Maintenance",
      requiredDocuments: ["Aadhaar Card", "10th Marks Card", "ITI or Diploma Certificate", "Passport Photo"],
    },
    {
      program: "Full Stack Web Development",
      requiredDocuments: ["Aadhaar Card", "Graduation Certificate / Marksheet", "Resume / LinkedIn Profile", "Photo ID"],
    },
    {
      program: "Solar PV Installation & Energy Systems",
      requiredDocuments: ["Aadhaar Card", "10th Marks Card", "Electrical Wireman License / ITI", "Medical Fitness Certificate"],
    },
    {
      program: "CNC Precision Machining & Robotics",
      requiredDocuments: ["Aadhaar Card", "10th/12th Certificate", "Technical Diploma (Mechanical)", "Passport Photo"],
    },
    {
      program: "Digital Marketing & Performance Media",
      requiredDocuments: ["Aadhaar Card", "12th / Graduation Marksheet", "Photo ID"],
    },
    {
      program: "HVAC & Commercial Refrigeration Technology",
      requiredDocuments: ["Aadhaar Card", "10th Certificate", "ITI Air Conditioning Certificate", "Address Proof"],
    },
  ];

  for (const template of programTemplates) {
    await prisma.documentTemplate.create({
      data: {
        organizationId: organization.id,
        program: template.program,
        requiredDocuments: JSON.stringify(template.requiredDocuments),
      },
    });
  }

  console.log(`✔ Seeded ${programTemplates.length} Program Document Templates`);

  // 7. Seed Sample Conversations
  await prisma.conversation.create({
    data: {
      agentId: voiceAgent.id,
      leadId: createdLeads[0].id,
      channel: "VOICE_CALL",
      transcript:
        "Agent: Hello Rohan, this is Aarav from Apex Vocational Academy. Did you request details on the EV Powertrain course?\nLead: Yes, I am an ITI mechanical graduate and want hands-on battery pack servicing training.\nAgent: Excellent! We offer weekend practicals at our Pune Campus. Can I book your demo visit for Saturday 11 AM?\nLead: Yes, please book it.",
      outcome: ConversationOutcome.CONVERTED,
      costInPaise: 420,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: whatsappAgent.id,
      leadId: createdLeads[1].id,
      channel: "WHATSAPP",
      transcript:
        "Lead: Hi, what is the syllabus for Full Stack Web Dev?\nAgent: Greetings Sneha! Sharing our 24-week curriculum covering React, Node.js, and Cloud deployment. Link: https://apextech.edu/syllabus\nLead: Thank you! When is the next batch starting?\nAgent: Next batch starts on March 25th. Would you like to reserve a provisional seat?\nLead: Yes, please share the application link.",
      outcome: ConversationOutcome.CONVERTED,
      costInPaise: 180,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: webChatAgent.id,
      leadId: createdLeads[2].id,
      channel: "WEBSITE_CHAT",
      transcript:
        "Lead: Does Solar PV course provide government certification?\nAgent: Yes, we are an approved training partner under NSDC & Skill India.\nLead: Can I speak with an admissions counselor about installment options?\nAgent: Connecting you with Counselor Priya now.",
      outcome: ConversationOutcome.ESCALATED,
      costInPaise: 95,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: voiceAgent.id,
      leadId: createdLeads[6].id,
      channel: "VOICE_CALL",
      transcript:
        "Agent: Hello Manish, following up from Apex Tech.\nLead: Look, I cannot afford 60,000 INR right now unless there is a 100% scholarship.\nAgent: We currently offer up to 25% merit scholarships.\nLead: That won't work for me, please cancel my inquiry.",
      outcome: ConversationOutcome.NO_RESPONSE,
      costInPaise: 380,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: createdAgents.EMAIL_NURTURE.id,
      leadId: createdLeads[3].id,
      channel: "EMAIL",
      transcript:
        "Agent: Subject: Still exploring vocational programs, Ananya?\nAgent Body: Here are 3 alumni success stories from our EV Powertrain batch. Reply if you'd like a callback.\nLead: Thanks, I'll think about it and get back next month.",
      outcome: ConversationOutcome.CONTINUED,
      costInPaise: 12,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: createdAgents.LEAD_QUALIFICATION.id,
      leadId: createdLeads[4].id,
      channel: "VOICE_CALL",
      transcript:
        "Agent: Hi Mohammed, quick 2-minute qualification call. What's your target start date and budget range?\nLead: I can start next quarter and my budget is around 20,000 INR.\nAgent: Great fit for our Digital Marketing cohort. Passing you to a counselor for the next steps.",
      outcome: ConversationOutcome.ESCALATED,
      costInPaise: 210,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: createdAgents.REENGAGEMENT.id,
      leadId: createdLeads[6].id,
      channel: "WHATSAPP",
      transcript:
        "Agent: Hi Manish, we now have a scholarship program covering up to 50% fees for ITI graduates. Interested in revisiting your application?\nLead: Oh really? Send me details.",
      outcome: ConversationOutcome.CONTINUED,
      costInPaise: 45,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: createdAgents.INTERVIEW_SCREENING.id,
      studentId: createdStudents[7].id,
      channel: "VOICE_CALL",
      transcript:
        "Agent: Hi Rhea, calling to schedule your technical screening interview for the Solar PV program.\nStudent: Can we do Friday afternoon?\nAgent: Confirmed for Friday 3 PM with our lead trainer.",
      outcome: ConversationOutcome.CONVERTED,
      costInPaise: 300,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: createdAgents.DOCUMENT_COLLECTION.id,
      studentId: createdStudents[2].id,
      channel: "WHATSAPP",
      transcript:
        "Agent: Hi Siddharth, your Diploma Certificate upload is still pending for your Solar PV enrollment. Please upload it here.\nStudent: Uploading now, sorry for the delay.",
      outcome: ConversationOutcome.CONVERTED,
      costInPaise: 30,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: createdAgents.PAYMENT_REMINDER.id,
      studentId: createdStudents[3].id,
      channel: "WHATSAPP",
      transcript:
        "Agent: Hi Kritika, your installment #2 of 18,000 INR was due on March 5th and is now overdue. Please pay via the link below to avoid a late fee.\nStudent: I'll pay by this weekend, having some cash flow issues.",
      outcome: ConversationOutcome.ESCALATED,
      costInPaise: 25,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: createdAgents.ONBOARDING.id,
      studentId: createdStudents[0].id,
      channel: "EMAIL",
      transcript:
        "Agent: Subject: Welcome to Apex, Akash!\nAgent Body: Here's your orientation schedule, campus map, and cohort WhatsApp group invite for EV Powertrain Maintenance.\nStudent: Thanks, looking forward to day one!",
      outcome: ConversationOutcome.CONVERTED,
      costInPaise: 10,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: createdAgents.SUPPORT_ESCALATION.id,
      studentId: createdStudents[6].id,
      channel: "VOICE_CALL",
      transcript:
        "Student: My attendance portal login isn't working and I might get marked absent.\nAgent: I've reset your portal access and flagged this to IT support, they'll confirm within the hour. Connecting you to a staff member to verify your attendance record.",
      outcome: ConversationOutcome.ESCALATED,
      costInPaise: 260,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: createdAgents.FEEDBACK_NPS.id,
      studentId: createdStudents[4].id,
      channel: "EMAIL",
      transcript:
        "Agent: Subject: How was your Full Stack Web Development cohort, Rahul?\nAgent Body: On a scale of 0-10, how likely are you to recommend Apex to a friend?\nStudent: 9/10, great hands-on projects and placement support.",
      outcome: ConversationOutcome.CONVERTED,
      costInPaise: 8,
    },
  });

  await prisma.conversation.create({
    data: {
      agentId: createdAgents.ALUMNI_REFERRAL.id,
      studentId: createdStudents[5].id,
      channel: "WHATSAPP",
      transcript:
        "Agent: Hi Bhavna, know anyone looking for HVAC training? Refer them and earn INR 2000 once they enroll.\nStudent: Yes, my cousin is interested, sharing her number.",
      outcome: ConversationOutcome.CONVERTED,
      costInPaise: 20,
    },
  });

  console.log("✔ Seeded 13 Agent Conversations across all roles");

  // 8. Seed Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: organization.id,
        userId: adminUser.id,
        action: "ORGANIZATION_INITIALIZED",
        entityType: "Organization",
        entityId: organization.id,
        changesJson: JSON.stringify({ name: organization.name, plan: "ENTERPRISE_B2B" }),
      },
      {
        organizationId: organization.id,
        userId: counselorUser.id,
        action: "LEAD_STAGE_UPDATED",
        entityType: "Lead",
        entityId: createdLeads[0].id,
        changesJson: JSON.stringify({ previousStage: "WARM", newStage: "HOT", score: 88 }),
      },
      {
        organizationId: organization.id,
        userId: counselorUser.id,
        action: "STUDENT_ENROLLED",
        entityType: "Student",
        entityId: createdStudents[0].id,
        changesJson: JSON.stringify({ cohort: "2026-Q1", program: "Electric Vehicle (EV) Powertrain Maintenance" }),
      },
    ],
  });

  console.log("✔ Seeded Audit Logs");

  // 9. Seed default Agent Triggers (proactive CRM-event → agent wiring)
  await prisma.agent.update({
    where: { id: createdAgents.PAYMENT_REMINDER.id },
    data: { outboundWebhookUrl: "https://example-retell-webhook.apextech.edu/agents/payment-reminder" },
  });
  await prisma.agent.update({
    where: { id: createdAgents.DOCUMENT_COLLECTION.id },
    data: { outboundWebhookUrl: "https://example-retell-webhook.apextech.edu/agents/document-collection" },
  });
  await prisma.agent.update({
    where: { id: createdAgents.REENGAGEMENT.id },
    data: { outboundWebhookUrl: "https://example-retell-webhook.apextech.edu/agents/reengagement" },
  });

  for (const suggestion of AGENT_TRIGGER_DEFAULT_SUGGESTIONS) {
    const agent = createdAgents[suggestion.role];
    if (!agent) continue;
    await prisma.agentTrigger.create({
      data: {
        organizationId: organization.id,
        agentId: agent.id,
        triggerEvent: suggestion.triggerEvent,
        conditions: suggestion.conditions ? JSON.stringify(suggestion.conditions) : null,
        enabled: true,
      },
    });
  }

  console.log(`✔ Seeded ${AGENT_TRIGGER_DEFAULT_SUGGESTIONS.length} default Agent Triggers`);
  console.log("\n✅ Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
