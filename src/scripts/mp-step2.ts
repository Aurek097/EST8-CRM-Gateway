import type { Script } from "./types";
import { action, ask, calc, cue, f, fields, list, M, optionRows, say, seg, sub } from "./dsl";

const T = (k: string, l: string) => seg(k, l, ["Through work", "Personal", "None"]);

export const mpStep2: Script = {
  id: "mp2",
  eyebrow: "Step 2 of 2 · The presentation",
  letters: "REAL",
  sections: [
    {
      id: "r1",
      letter: "R",
      title: "Rapport",
      blocks: [
        cue(
          'Build rapport for a few minutes. Find common ground, but don\'t overdo it or become a "professional visitor." In the home, head to the kitchen table. Friendly, but in control.',
        ),
        list(
          "rapport",
          [
            "Compliment them on connecting to Zoom, if it fits",
            "New home or refinance? On the phone they said they {{purchase}}",
            "How long in the area? Moved from elsewhere?",
            'Occupation: {{occupation}}. "How did you get started in that?"',
            "Family: any family nearby?",
          ],
          "Checklist",
        ),
      ],
    },
    {
      id: "r2",
      letter: "R",
      title: "Transition to the presentation",
      blocks: [
        say("So, let me start off by showing you a few things about me."),
        cue("Share your screen if virtual."),
        say(
          "Here's my insurance license… driver's license and business card… picture of my family…",
        ),
        cue("This confirms your identity and purpose."),
        say("Let me show you, this is what you folks mailed in…"),
        cue("Show the lead."),
        say(
          "Which one of you responded? And I know we talked about this briefly on the phone with you, {{first}}, but now that we're all together, what was your main concern?",
        ),
        cue('This is their "surface why."'),
        calc("phoneSaid"),
        say(
          "So, what I'm hearing is {{concern}}. Is that right? Well, that makes sense for sure. And how long have you guys been thinking about this kind of protection?",
        ),
        cue("Repeat it back in your own words."),
      ],
    },
    {
      id: "r3",
      letter: "R",
      title: "What is mortgage protection?",
      blocks: [
        say(
          "OK, {{first}}, real quick let me explain what mortgage protection is. You probably already know, but it's a life insurance policy for homeowners that will pay off the mortgage or make mortgage payments while the family is in transition after someone dies. Mortgage protection can also be used to replace income if the breadwinner has a critical illness or disability in their working years.",
        ),
        say(
          "Now, this is not the old kind of mortgage protection, meaning your lender will not be your beneficiary. So, who would your beneficiary be?",
        ),
        fields([f("beneficiary", "Beneficiary"), f("benRel", "Relationship")]),
        cue("Write this down."),
        say(
          "So, {{beneficiary}} will receive the benefit. One of the other major differences is that this is not a decreasing term. In other words, if something happens to you tomorrow or 10 years from now, your death benefit will remain the same. This policy is also portable, so if you refinance or move, you can take this mortgage protection with you.",
        ),
        say(
          "Now, some people do a full mortgage payoff if that's in the cards. Some do half. A lot of people just do a little bit, just a little bit to help their family with the transition to the next step, okay? It really depends on two things. First, it depends on budget; everyone's got a budget. And second, it depends on what you qualify for in terms of age and health. Make sense?",
        ),
        cue(
          "Wait for a response. Keep them accountable to your questions early; it carries through the whole presentation.",
        ),
        say(
          "Now, it's important to know most people already have life insurance. It's really common. Some have it through work, some have their own policy, some have 401(k) money, maybe a rich uncle. I'm still waiting on mine. Some have money in the bank. In other words, we all work to build up a nest egg, right?",
        ),
        say(
          "That's why people get mortgage protection separately. They don't want their family to have to use the nest egg money to pay for the mortgage. They want that nest egg to go to the family, and they want the insurance company to pay off the mortgage debt. It's another way people use life insurance nowadays. Does that make sense?",
        ),
      ],
    },
    {
      id: "r4",
      letter: "R",
      title: "Explain your role and purpose",
      blocks: [
        say(
          "My role in all of this is what they call a 'field underwriter.' Each week I work with 12 to 15 families in your area who have all requested this type of insurance. I have access to all the top-rated companies that offer this coverage, so I'm able to shop around for you. My job is to find you the best coverage you qualify for at the best price.",
        ),
        cue('This eliminates the "I need to shop around" concern.'),
        say(
          "So, there are a few things we'll do today. I'm going to verify your health information. Some carriers are super picky about prescriptions and medical concerns, others are not, so I need to know the details so I can match you with the best company. I don't work for any one company. I work for you. So please be honest with me so I can help get your family protected. The good news is you don't have to see a nurse or give blood or urine with these programs.",
        ),
        cue("Eases their mind about health issues and builds trust."),
        say(
          "Then I have some detailed questions about your mortgage and your finances. Some of these might even be uncomfortable for me to ask, but I'm not doing this to be nosy. I'm doing it to make sure, in my professional opinion, that you have a need for this coverage. Not everyone has a need, and if that's the case with you, I'll let you know honestly and be on my way. We find most people need way less than they think, and if that's the case I can save you some money and be the hero.",
        ),
        cue("Sets up Critical Period or partial payoff, and explains why you ask about finances."),
        say(
          "Once we narrow this down to a few programs I think you'll qualify for, your job is to pick out the program that best suits your needs and your budget.",
        ),
        cue("Gives them an active role in the process."),
        say(
          "As we're talking, I'll be filling out some paperwork on my screen, and this is what we'll be submitting to the insurance company tonight to get their final approval, which could take two to seven days. Once they approve the application your family will be protected. It usually takes about 10 to 14 days to get the policy mailed to you, and then we'll get back on the phone or computer, go over everything together in detail, and make any changes if needed. Sound good?",
        ),
        cue('This gets your first "yes."'),
      ],
    },
    {
      id: "e1",
      letter: "E",
      title: "Verify health",
      blocks: [
        cue(
          "Health is the easiest place to start: you began it on the phone and it's less emotional. Finances come next and do the heavy lifting for creating the emotion.",
          "Emotion",
        ),
        say(
          "First, we need to verify the medical side to confirm which carriers you would qualify with.",
        ),
        cue("Review the CQF from the phone call. Edit anything that changed."),
        fields([
          f("health", "Health", "area"),
          f("meds", "Medications", "area"),
          f("hospital", "Hospital / surgeries", "area"),
          f("history", "History", "area"),
          f("hwA", "Height / weight", "text", { placeholder: "5'10, 180" }),
          seg("tobacco", "Tobacco", ["No", "Yes"]),
        ]),
        fields(
          [
            f("spouseHealth", "Spouse health", "area"),
            f("spouseMeds", "Spouse meds", "area"),
            f("hwB", "Spouse height / weight"),
            seg("spouseTobacco", "Spouse tobacco", ["No", "Yes"]),
          ],
          M,
        ),
        say(
          "I'm going to share my screen and run through a list of about 15 health questions. Some of these are going to sound crazy, but I have to ask them anyway. And if any are 'yes,' don't worry. I just need your full honesty like I mentioned earlier. So just really quickly, what medications are you prescribed…",
        ),
      ],
    },
    {
      id: "fif",
      letter: "E",
      title: "Financial information form (FIF)",
      blocks: [
        cue("Required for every client. It also sets up future Preferred Client Services needs."),
        say(
          "Okay, so now I want you guys to grab a pen and paper and let me know when you're ready.",
        ),
        cue(
          "Virtual: share a whiteboard or fill the FIF with them watching. Have them actively participate.",
        ),
        say(
          "So that we can get a better picture of what cash flow would look like, we're going to do a quick financial review.",
        ),
        ask(undefined, '"What do you do for a living, and what do those hours look like?"', [
          f("occupation", "Occupation"),
          f("schedule", "Schedule"),
          f("spouseOccupation", "Spouse occupation", "text", { showWhen: M }),
          f("spouseSchedule", "Spouse schedule", "text", { showWhen: M }),
        ]),
        sub("Get the equity number"),
        cue("A critical step for any equity protection plan during the critical period."),
        say(
          "So, your mortgage is about [[v:loanAmount]], right? Let's write that at the top of the page. And let me ask you: if you had the time to prep the home and put it on the market tomorrow, and didn't have to take a low offer, you were patient and got the full value, what would it sell for?",
        ),
        fields([f("homeValue", "Home value", "money")]),
        say(
          "Okay, write that number next to what you owe. If we subtract what is owed from what it would sell for, we get {{equity}} in equity. Is that what you see as well?",
        ),
        cue("People should be proud of their equity. Congratulate them."),
        say(
          "And that's today. Ten years from now it's thousands more; 15 or 20 years from now it can be hundreds of thousands more. As time goes by, what you owe goes down and what it's worth goes up. This equity is often the biggest part of the legacy left for a family. Does that make sense? Let's write the equity just below those numbers.",
        ),
        say(
          "For most families, the number one job for mortgage protection is to make sure that equity stays with the family and never walks out your front door, right? That's your family's money, part of your nest egg. It should never go to the bank or to a low-ball investor buying your home as a distressed sale, right? So, at a minimum, we need to protect that equity. Do you see that?",
        ),
      ],
    },
    {
      id: "budget",
      letter: "E",
      title: "Quick budget",
      blocks: [
        cue(
          'List the mortgage payment, major debts and major monthly expenses. Approximate numbers only; don\'t frustrate them with detail. This heads off "we need to check our budget."',
        ),
        ask(1, '"Your monthly mortgage payment is {{payment}}, right?"', [
          f("monthlyPayment", "Monthly payment", "money"),
        ]),
        ask(
          2,
          '"Roughly, if you had to estimate your utilities, groceries, car payment, cell phone, internet, all of your bills, what would that run you per month?"',
          [f("otherBills", "Other monthly bills", "money")],
        ),
        ask(3, '"And total debt: credit cards, revolving loans, student debt?"', [
          f("debtTotal", "Total debt", "money"),
        ]),
        ask(4, '"Are we putting any money towards retirement?"', [f("retirement", "Retirement")]),
        calc("billsLine"),
      ],
    },
    {
      id: "cash",
      letter: "E",
      title: "Uncover the cash flow problem",
      blocks: [
        cue(
          "Cash flow is the problem we're solving. Helping them see the cash flow problem when someone passes creates the emotion.",
        ),
        say(
          "Now, let's make two columns on the page. One for you, {{first}}, and one for you, {{spouse}}.",
          M,
        ),
        say(
          "{{first}}, if you didn't come home last night, what is already in place that would pass on to {{spouse}} to help keep this house and this lifestyle, like other life insurance, savings, retirement accounts?",
          M,
        ),
        say(
          "{{first}}, if you didn't come home last night, what is already in place that would pass on to {{beneficiary}} to help with this house, like other life insurance, savings, retirement accounts?",
          "!married",
        ),
        fields([
          f("inPlaceA", "In place"),
          f("lifeA", "Life insurance amount", "money"),
          T("lifeAType", "Type"),
        ]),
        say(
          "And {{spouse}}, same questions for you: what's already in place today that would pass on to {{first}} to help keep the house and the lifestyle?",
          M,
        ),
        fields(
          [
            f("inPlaceB", "In place (spouse)"),
            f("lifeB", "Spouse life insurance", "money"),
            T("lifeBType", "Type"),
          ],
          M,
        ),
        say(
          "Perfect. That usually covers the loss of about one year's income if you die while you're employed there. What do you have in the way of personal life insurance to protect your mortgage and family? Great, what's that coverage amount, and what's the monthly cost?",
          "workCoverage",
        ),
        say(
          "Okay, let's talk about income. {{first}}, what do you bring in on a monthly basis? And {{spouse}}?",
          M,
        ),
        say(
          "Okay, let's talk about income. {{first}}, what do you bring in on a monthly basis?",
          "!married",
        ),
        fields([
          f("incomeA", "Income (monthly)", "money"),
          f("incomeB", "Spouse income (monthly)", "money", { showWhen: M }),
          f("otherIncome", "Other income", "money"),
        ]),
        say("Any pensions for either of you? Military benefits? Any other income?"),
        calc("incomeLine"),
        cue("Write down this total."),
        say(
          "Now, if something happened to you first, {{first}}, how much money would stop coming into the house from your side every month? Would any income transfer over? Okay. And what about you, {{spouse}}, how much would stop coming in if something happened to you?",
          M,
        ),
        fields(
          [
            f("lossA", "Income lost if {{first}} passes", "money"),
            f("lossB", "Income lost if {{spouse}} passes", "money"),
          ],
          M,
        ),
        cue(
          "Leave blank to assume their full income stops. Social Security: if married, the surviving spouse keeps the higher of the two benefits and the other goes away. Ask if they understand how that works.",
        ),
      ],
    },
    {
      id: "cfa",
      letter: "E",
      title: "Cash flow analysis",
      blocks: [
        calc("cashflowTable"),
        cue("The cash flow problem should be obvious now. Take your time and let it sink in."),
        say("Okay, I can better understand now why you responded to the letter."),
      ],
    },
    {
      id: "qq",
      letter: "E",
      title: "Quality questions",
      blocks: [
        cue(
          "Pick a few based on the situation, the program and your preference. Tick them off as you go.",
        ),
        list(
          "qqMarried",
          [
            '"How long would you want to stay in this house by yourself?"',
            '"How long could you stay in this house?"',
            '"Where would you want to go?"',
            '"Who would have to move in with you?"',
            '"Knowing this cash flow analysis, what specific challenges would you have?"',
            '"What would you have to do to maintain the mortgage and your lifestyle?"',
            '"What does that look like?"',
            '"How do you feel about that, {{spouse}}?"',
            '"What are your thoughts, {{spouse}}?"',
            '"How long do houses take to sell around here?"',
          ],
          "Married",
          M,
        ),
        list(
          "qqSingle",
          [
            '"What would the kids do with this house?"',
            '"Which of your kids would be making this mortgage payment?"',
            '"Do they have a mortgage as well that they would need to also pay?"',
            '"How hard would it be for your kids to make their own mortgage or rent and this one?"',
            '"How long do houses take to sell around here?"',
            '"Would all of the kids move in here together, or would one child most likely need to?"',
            '"Would one child buy out the others?"',
          ],
          "Single",
          "!married",
        ),
        list(
          "qqIncome",
          [
            '"{{first}}, if you passed away yesterday and your {{incomeA}} income was no longer coming into your household, how long would it take before life would become difficult for {{beneficiary}}? Would the kids need to change schools?"',
            '"If something happened to you yesterday, how would {{beneficiary}} take care of themselves?"',
            '"How would life need to change to make it work?"',
            '"How long would {{beneficiary}} want to keep staying in this house if you were to pass away?"',
            '"Can we agree that your family, like most families, would have some tough decisions to make with the loss of an income?"',
          ],
          "Loss of income (SFG)",
        ),
        say(
          "After looking at this, it makes sense. You're a lot like the families I meet with each week. We would be in a tough spot with the loss of an income. I completely understand why you reached out, and this is why I love my job. It allows me to provide peace of mind for responsible people.",
        ),
      ],
    },
    {
      id: "a1",
      letter: "A",
      title: 'The "think about it"',
      blocks: [
        cue(
          "Assume they want the coverage. Price only matters in the absence of value. Sell on needs; use features and benefits to lock the sale down after it's made.",
          "Assumption",
        ),
        calc("road"),
        say(
          "Based on what you just shared with me, let's look at some programs. I'm going to include at least one that is our most comprehensive. I'm not doing that to talk you into spending more than you're comfortable with; I just want to show you all of your options. But I'm going to count on you to be honest about your budget. Sometimes homeowners will beat around the bush and say things like 'I need to think about it, sleep on it.' I've been doing this long enough to know what that means: the price isn't right. So, if what I'm showing you doesn't fit the budget, can I count on you to be honest with me? These are just some of the programs, and we'll definitely find you something tonight that fits comfortably inside your budget as a good starting place, OK?",
        ),
      ],
    },
    {
      id: "a2",
      letter: "A",
      title: "Explain programs",
      blocks: [
        say("There are three ways to do mortgage protection."),
        sub("1 · Full payoff"),
        cue(
          "Explain full payoff, Living Benefits and ROP to clients 65 or under; ROP and disability riders have age restrictions. If you are going Critical Period, keep this short.",
        ),
        say(
          "This will make sure the family keeps the home and pays the mortgage off in its entirety. It also provides Living Benefits for critical and chronic illness. If you get diagnosed with a critical illness like cancer, or have a heart attack, you can access the death benefit while you're alive, so you can recover without having to worry about the loss of work or your income. My clients see a lot of value in this feature.",
          "!over65",
        ),
        say(
          "Full coverage is generally the most expensive and hardest to qualify for. And 95% of the time I can find something more affordable for my clients over 65.",
          "over65",
        ),
        sub("2 · Partial payoff"),
        say(
          "As we discussed earlier, this is great for families that have two people bringing in income, especially during their working years. Let's say one person can't work or dies. It's always helpful to have half the mortgage paid down, or a big chunk paid down, so it's affordable for the remaining person. For example, if something happens and I brought you a check for {{halfLoan}} even though your mortgage is {{loan}}, would you be mad at me? What could you do with that {{halfLoan}}?",
        ),
        cue(
          "Stop and get them to engage: pay down the loan, refinance for a lower payment, a down payment on a smaller place.",
        ),
        say(
          "With your age and health, honestly, {{first}}, this one can also be hard to qualify for. For really anyone over 65. But it is a little cheaper than full payoff.",
          "roadCP",
        ),
        sub("3 · Critical period / equity protection"),
        {
          t: "note",
          text: "Skip this option: {{first}} is under 65 with no health flags.",
          showWhen: "roadFull",
        },
        say(
          "Most of my clients around your age with similar health go for option three. It's the most affordable and the easiest to qualify for. It's called Critical Period Coverage, or Mortgage Payment Protection, because it covers the most critical period of time after the loss of a spouse or loved one, when the family is at most risk of losing the home. Let me explain.",
          "!roadFull",
        ),
        cue(
          "Start by talking to the person who would be in the most trouble if something happened to the breadwinner.",
          "Cue",
          "!roadFull",
        ),
        say(
          "If something were to happen to {{breadwinner}} tomorrow, does the bank come to {{survivor}} and ask for the full {{loan}} you owe? No, they just want what?",
          "!roadFull",
        ),
        cue("Stop. Get them to say the bank just wants the payment.", "Cue", "!roadFull"),
        say(
          "People go into foreclosure not because the bank wants the payoff, but because the bank wants the payment. It would be nice if the bank called and said, 'We're so sorry for your loss, we're going to waive your payments for the next six months to a year,' but they don't do that, do they? They probably won't even know someone has died. They just want the payment.",
          "!roadFull",
        ),
        say(
          "What this program is going to do for you is buy you some time. Time to grieve properly, time to make a plan, and time to put the house on the market long enough to get top dollar for it, without your family having to come out of pocket for that mortgage payment each month. In my opinion, I wouldn't spend a bunch of money trying to pay off a house you don't plan on staying in anyway. Instead, the policy would cover mortgage payments long enough to sell it and get out the equity. That equity can become the benefit for {{beneficiary}}, the legacy for your family. Many times the equity in the home is the biggest asset a family has! Does that make sense?",
          "!roadFull",
        ),
        say("Of these three ways I just described, which one should we begin pricing?"),
        fields([seg("program", "Program", ["Full payoff", "Partial payoff", "Critical period"])]),
      ],
    },
    {
      id: "a3",
      letter: "A",
      title: "Show options",
      blocks: [
        calc("quoteSheet"),
        fields([
          seg("qpHealth", "Health class", ["PP · Preferred Plus", "P · Preferred", "R · Regular"]),
          seg("qpNic", "Nicotine", ["Never", "Currently", "Recently quit"]),
          seg("qpTerm", "Term", ["10", "20", "30"]),
        ]),
        calc("quoteLink"),
        calc("anchor"),
        say(
          "Knowing that most people will need at least a few months to grieve, how long do you think it would take you or your kids after that to make a plan, pack up, get the house ready to sell and allow time on the market for it to receive the highest offer?",
          "progCP",
        ),
        fields([f("monthsNeeded", "Months needed")], "progCP"),
        optionRows(),
        cue(
          "Before showing numbers, answer the common questions up front: \"Just so you know some more details of this program… this is a ____ (term/whole) life program… premiums won't increase… the death benefit won't decrease… the money is delivered in a lump sum to your beneficiary.\" Showcase free riders, level premiums, cash value.",
          "Features",
        ),
      ],
    },
    {
      id: "a4",
      letter: "A",
      title: "The close",
      blocks: [
        say("Okay, now which one of these fits most comfortably inside your budget?"),
        cue(
          "Be quiet. Don't speak until they speak first. Once they pick, repeat it back so the decision is made.",
        ),
        fields([seg("chosen", "Chosen", ["Option 1", "Option 2", "Option 3"])]),
        say("Great. So we're going with {{chosen}}."),
        say(
          "Okay, from here I'm going to share my screen and finish filling out your paperwork. Go ahead and grab your driver's license for me. While you're doing that, what is the full name of your beneficiary?",
        ),
        fields([f("benFull", "Beneficiary full legal name")]),
        action("Mark quoted", "quoted"),
      ],
    },
    {
      id: "a5",
      letter: "A",
      title: "Application and policy delivery",
      blocks: [
        cue(
          "Move quickly to avoid decision remorse. Begin the application. Then set expectations on how and when they get the policy.",
        ),
        fields([f("carrier", "Carrier", "carrier")]),
        calc("writingNumber"),
        calc("delivery"),
        action("Application submitted", "appSubmitted", true),
      ],
    },
    {
      id: "l1",
      letter: "L",
      title: "Lock it down: secure the sale",
      blocks: [
        cue("If you didn't make the sale, skip to the client survey."),
        say(
          "One thing I take pride in is making the right recommendations to my clients and making sure you're satisfied with your program. I'd like you to tell me in your own words: what did we just do here today?",
        ),
        calc("lockPrompts"),
        say("What questions do you have for me before I leave?"),
        say(
          "The program we chose today, do you have peace of mind that this will help your family?",
        ),
        say(
          "Over the next ____ days or weeks, I'm going to work with the insurance company to get your policy approved. I'll be checking in with you every few days to let you know how things are going. When the policy is approved, we'll review it together. We'll also do an annual policy review with someone from our Member Services department.",
        ),
        say("Also, let's take a minute to save my number in your phone: {{agentPhone}}."),
        cue("Having them save it means they recognize your number when you call."),
        say(
          "Contact me anytime for anything. I'm your agent now. If anyone else calls you about life insurance, feel free to give them my number and have them call me. Our company may send you a few more letters in the mail; you can ignore those now that we have a program in place for you.",
        ),
      ],
    },
    {
      id: "l2",
      letter: "L",
      title: "Referrals",
      blocks: [
        cue("The 4 Rs after the sale: Rx card, Referral, Reset, Recruit."),
        say(
          "Before I let you go, I wanted to let you know that billions of dollars in life insurance benefits go unclaimed each year. That happens when beneficiaries don't receive the death benefit after the insured person dies, often because they don't know about the policy or who issued it. So here's what I want for you: 4 or 5 names of people you love and have trusted over the past several years. I'll call them and let them know they're on my file for your policy, and make sure they have my information saved. These are the people who will help make sure your family gets the money. So go ahead with those 4 or 5 people. And please shoot them a message to let them know I'll be contacting them, so I'm not just some random person reaching out.",
        ),
        fields([f("referrals", "Referrals", "area")]),
      ],
    },
    {
      id: "l3",
      letter: "L",
      title: "Reset",
      blocks: [
        calc("debtRet", "hasDebtOrRet"),
        say(
          "We do a lot more than life insurance. We also have debt elimination plans where you can pay off your debt without spending any more monthly than you are now and build wealth. We can help you build your retirement, or help you protect a portion of your assets from market volatility. If your mortgage and other debts were paid off, would retirement be more comfortable?",
        ),
        cue("If they say none and they're fine right now, continue."),
        say("Do you feel like your debt is preventing you from contributing to your retirement?"),
      ],
    },
    {
      id: "l4",
      letter: "L",
      title: "Client survey",
      blocks: [
        cue("If they have assets or are still working, do this whether or not you made the sale."),
        say(
          "Lastly, before I leave, given some of the information you gave me earlier, I just have a brief client survey to complete with you. Our Client Services department can help clients with several aspects of their overall financial plan, and I want to make sure we aren't missing anything before I leave.",
        ),
        cue("Work through the Client Survey sheet. Book a follow-up based on the answers."),
        fields([f("surveyNotes", "Survey notes", "area"), f("followUp", "Follow-up")]),
      ],
    },
  ],
};

export const DELIVERY: [string, string, string][] = [
  ["American Amicable", "Would you like your policy mailed or emailed to you?", "Mail 5–6 days"],
  ["Americo", "Would you like your policy mailed or emailed to you?", "Mail 5–6 days"],
  ["Corebridge/AIG", "Would you like your policy mailed or emailed to you?", "Mail 7–9 days"],
  [
    "F&G",
    "You will receive your policy in the mail in 6 to 9 days.",
    "Mark deliver to PI in the special instructions",
  ],
  [
    "Foresters",
    "You'll receive your policy in your email shortly. Or: Your policy will be delivered in 5 to 7 days.",
    "",
  ],
  [
    "LGA",
    "You have the option of downloading the policy now, or you can follow the link they emailed you. It takes you to the policy owner portal, where you register and download your policy.",
    "",
  ],
  [
    "Mutual of Omaha",
    "You'll receive your policy in your email shortly, and a copy will also be mailed to you.",
    "Mail 5–7 days",
  ],
  [
    "SBLI",
    "You'll receive an email with a link to my.sbli.com to register your account and download your policy.",
    "",
  ],
  [
    "Transamerica",
    "Fast Doc: You'll receive your policy shortly by email. Non-Fast Doc: You'll receive your policy in the mail.",
    "Non-Fast Doc mail 6–9 days",
  ],
  ["UHL", "You'll receive your policy in the mail.", "Mail 5–7 days"],
];
