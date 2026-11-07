import type { Script } from "./types";
import { action, ask, calc, cue, dialRow, f, list, M, note, say, seg, verify } from "./dsl";

export const mpStep1: Script = {
  id: "mp1",
  eyebrow: "Step 1 of 2 · Phone call",
  letters: "BEST",
  sections: [
    {
      id: "b",
      letter: "B",
      title: "Be busy",
      blocks: [
        calc("weeklyGoals"),
        note(
          "Pick up the phone. This is a numbers game: the more dials, the more appointments, the more families you help. Most successful full-time agents make 500+ dials a week, or dial until they have 20+ appointments to submit $5,000+ APV weekly.",
        ),
        dialRow(),
      ],
    },
    {
      id: "e1",
      letter: "E",
      title: "Establish the reason you're calling",
      blocks: [
        cue(
          "They sent in a request asking for help. Now it's your turn to help them get the coverage they deserve.",
          "Mindset",
        ),
        say("Hey, {{first}}."),
        cue("Wait for response."),
        say(
          "Hey, this is {{agent}}. I'm calling about your mortgage over at [[v:address]]. Looks like it's for [[v:loanAmount]].",
        ),
        cue("Pause and wait."),
        say(
          "I was getting back to you about the form you responded to regarding the mortgage protection coverage that would help pay the mortgage for your family if something were to happen. I just needed to quickly verify the information you provided so we can get those options worked up for you.",
        ),
        say(
          "You had put down that you're [[v:age]]. Is that correct? And when do you turn {{nextAge}}? When's your birthday?",
        ),
        verify("Birthday on the lead: [[v:dob]]"),
        ask(undefined, "Married, or a spouse on the loan?", [
          seg("married", "Married?", ["Married", "Single"]),
          f("spouseName", "Spouse name", "text", { showWhen: M }),
        ]),
        say(
          "And I have {{spouse}}'s age as [[v:spouseAge]] and date of birth as [[v:spouseDob]]?",
          M,
        ),
        cue("Start filling out the client qualification form (CQF) below."),
      ],
    },
    {
      id: "e2",
      letter: "E",
      title: "The why: who's counting on them",
      blocks: [
        say(
          "Now, one of the most common needs my clients have is that if something were to happen, their family would need to be able to keep paying bills, manage their life and kids, and take care of the mortgage. Is that how you feel?",
        ),
        ask(
          undefined,
          '"God forbid something were to happen to you, who would be financially responsible for the bills?"',
          [f("beneficiary", "Name"), f("benRel", "Relationship")],
          "Capture the name and relationship.",
        ),
        say("Would {{beneficiary}} be your beneficiary on this plan?"),
        ask(undefined, '"Can I ask, did you guys just buy your home, or did you refinance it?"', [
          seg("purchaseType", "Purchase", ["Just bought", "Refinanced"]),
        ]),
        list(
          "warmup",
          [
            '"Congratulations!"',
            '"How do you like living there?"',
            '"What made you choose that area?"',
          ],
          "Warm-up",
        ),
      ],
    },
    {
      id: "cqf",
      letter: "E",
      title: "Client qualification form (CQF)",
      blocks: [
        say(
          "I have a couple of quick questions so I can make sure I'm looking at the right companies for you.",
        ),
        ask(1, '"How\'s your health? Any medical issues?"', [f("health", "Health", "area")]),
        ask(
          2,
          '"Have you used any nicotine or tobacco in the last 12 months? You don\'t plan on starting this weekend, do you?"',
          [
            seg("tobacco", "Tobacco", ["No", "Yes"]),
            seg("spouseTobacco", "Spouse tobacco", ["No", "Yes"], { showWhen: M }),
          ],
          "Get a laugh and put them at ease.",
        ),
        ask(3, '"What medications does your doctor have you on?"', [
          f("meds", "Medications", "area"),
        ]),
        ask(
          4,
          '"Any hospital stays, ambulance rides or major surgeries for you in the past 10 years or so?"',
          [f("hospital", "Hospital / surgeries", "area")],
        ),
        ask(
          5,
          '"And how about {{spouse}}? Anything for them?"',
          [f("spouseHealth", "Spouse health", "area"), f("spouseMeds", "Spouse meds", "area")],
          undefined,
          M,
        ),
        ask(
          6,
          '"Is there any history of things like high blood pressure, diabetes, cancer or heart attack for either of you?"',
          [f("history", "History", "area")],
        ),
        ask(7, '"And then, just ballpark, what\'s your height and weight?"', [
          f("hwA", "Height / weight", "text", { placeholder: "5'10, 180" }),
          f("hwB", "Spouse height / weight", "text", { placeholder: "5'4, 140", showWhen: M }),
          seg("gender", "Gender", ["Male", "Female"]),
        ]),
        ask(
          8,
          '"What do you do for work? Anything dangerous, like a stunt man or rodeo clown?"',
          [
            f("occupation", "Occupation"),
            f("spouseOccupation", "Spouse occupation", "text", { showWhen: M }),
          ],
          "Get a laugh.",
        ),
        ask(
          9,
          '"And what does your work schedule typically look like? 9 to 5, Monday through Friday?"',
          [
            f("schedule", "Schedule"),
            f("spouseSchedule", "Spouse schedule", "text", { showWhen: M }),
          ],
        ),
        ask(
          10,
          '"It says the amount of the mortgage to be paid off is [[v:loanAmount]]. Is that correct?"',
        ),
        ask(11, '"And did you guys go with a 15 or a 30-year loan?"', [
          seg("loanTerm", "Loan term", ["15-year", "30-year", "Other"]),
        ]),
        ask(12, '"And what\'s the monthly payment on that?"', [
          f("monthlyPayment", "Monthly payment", "money"),
        ]),
        ask(13, '"Do you have children in the house?"', [
          f("children", "Children (how many, names)"),
        ]),
        ask(
          14,
          '"Alright, perfect. And most importantly, when you responded to the form, what was the main concern for you? What specifically were you wanting the coverage to do for you?"',
          [
            f("mainConcern", "Main concern (the problem)", "area"),
            f("goal", "Goal (the solution)", "area"),
          ],
          "Write it in their words; it's repeated back at the appointment.",
        ),
        ask(
          15,
          '"Were you looking for coverage on just yourself, or for both you and {{spouse}}?"',
          [seg("coverageFor", "Coverage for", ["Just me", "Both of us"])],
          undefined,
          M,
        ),
      ],
    },
    {
      id: "pivot",
      letter: "S",
      title: "Pivot: present now or set the appointment",
      blocks: [
        say(
          "We've addressed a lot of things, and if you can stay with me, I can go over some options that will solve the issues we discussed. Does that work?",
        ),
        say(
          "Is this something you'd want to discuss with someone else before making a decision on protecting {{beneficiary}}?",
        ),
        ask(
          undefined,
          "Can they stay on now?",
          [seg("stayNow", "Stay on", ["Yes, present now", "No, set the appointment"])],
          "If married and the spouse isn't on the line, set the appointment so both are there.",
        ),
        action("Go to Step 2: the presentation →", "goStep2", true, "stayYes"),
        say("I completely understand, I have a busy day too.", "stayNo"),
      ],
    },
    {
      id: "appt",
      letter: "S",
      title: "Set the appointment",
      showWhen: "!stayYes",
      blocks: [
        say(
          "Okay, that makes a lot of sense. I have enough information to start shopping your case across all the carriers. I'll need some time to do that, and then we'll just need to schedule a quick call to go over the options together, see what might make sense for you, and answer any questions you might have. Let me just pull up my calendar.",
        ),
        say("We've had a ton of these requests come in, so my schedule is pretty crazy right now."),
        cue("Begin the funnel: two days, two timeframes, two times.", "Funnel"),
        calc("funnelDates"),
        say(
          "I have a couple of openings either today or tomorrow. Which of those would work best?",
        ),
        cue("Two days. Book within 48 hours; 24 is ideal."),
        { t: "fields", fields: [f("apptDay", "Appointment day", "date")] },
        say("Okay. For {{apptDay}}, would earlier or later in the day work better?"),
        cue("Two timeframes. Afternoon or evening? Before 5 pm or after 5 pm?"),
        say(
          "Okay. I have an opening at {{timeA}} or I can squeeze you in at {{timeB}}. Which of those would be better for you{{andSpouse}}?",
        ),
        cue("Two times. Change the default offer times in Settings."),
        {
          t: "fields",
          fields: [f("apptTime", "Appointment time", "text", { placeholder: "5:15 pm" })],
        },
        say(
          "It's very important that {{spouse}} is on the call, because if something happens, they're the one who's going to call me.",
          M,
        ),
      ],
    },
    {
      id: "tie",
      letter: "T",
      title: "Tie down",
      showWhen: "!stayYes",
      blocks: [
        say(
          "Okay, and you're positive that time works for both you and {{spouse}} together, correct?",
          M,
        ),
        cue("No one-legged appointments. Find a time when both are available.", "Cue", M),
        say(
          "Okay, grab a pen and paper and let me know when you're ready. I'm going to give you my information and a few things to have ready for our appointment.",
        ),
        say(
          "Go ahead and write down my name. It's {{agent}}. Then write down 'Mortgage Protection.' And what time did we say again? Perfect. Go ahead and write that down as well. And just a couple things to have ready before our call: make sure you have your doctor's info and any medications you're on, just have those available.",
        ),
        say("And what's a good email for me to send the appointment confirmation to?"),
        verify("Email on the lead: [[v:email]]"),
        say(
          "Okay, I have us down for {{apptDay}} at {{apptTime}}. Sometimes the families I'm working with need a little extra time, so give me about a 15-minute window, just in case, and I'll make sure I give you the time you need as well. If I'm running more than 15 minutes behind, I'll make sure I let you know.",
        ),
        say(
          "I really value our time and do my best to keep a tight schedule for everyone. If we aren't able to meet at {{apptTime}}, it will impact my ability to help another family during that time.",
        ),
        say("Have a great day and we'll talk to you on {{apptDay}} at {{apptTime}}."),
        action("Mark appointment set", "apptSet", true),
      ],
    },
  ],
};

export const POWER_PHRASES = [
  "\"That's exactly why I'm calling.\"",
  "\"Here's what we're going to do.\"",
  '"Let\'s do this…"',
  '"I can try to squeeze you in at {{timeB}}."',
  '"Grab a pen and let me know when you\'re ready." (not "Can you grab a pen?")',
  'If they say "Can you just email me / call me back later?": "That\'s a great idea! I\'ll be super brief. Let me verify your information quickly, then I\'ll get your options out to you."',
  "We never email options; the first call books the appointment, and options are shared live.",
];
