Tons of american adults are illiterate. At one point in my life i was a literacy tutor. I still believe everyone should learn to read and that reading novels can enhance our lives. However, I am realistic and can see a near future where literacy is no longer considered normal or a goal. 

Now: we have lots of illiterate people who are leaning on friends, family, retail workers to navigate things they must read for them. Medicaid forms, menus, so on and so forth. I understand this is embarrassing for them. 

The idea: an iOS and Android app with a memorable icon and simple UX for the illiterate. It uses OCR and text-to-voice to read and explain the written word. almost like the "be my eyes" app for the blind.


Point camera at text, tap button, hear it read aloud. Optional second tap for "explain this simply." That's it. No accounts, no onboarding flow, no settings. The entire UX is: open app, point, tap, listen.


Start with cloud OCR (Google Cloud Vision) even though on-device is possible. It's easier to debug, the accuracy is better, and for an MVP the latency is fine. Optimize later if the per-call cost becomes a problem at scale.