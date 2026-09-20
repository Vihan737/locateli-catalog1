// api/chat.js — Locatelli product-advisor chat backend
// Self-contained: the advisor's knowledge/tone prompt is embedded below, so this
// is the ONLY file needed inside the api/ folder.
//
// Supported free providers (first one with a key set wins, with automatic
// fallback to the next if it fails):
//   GEMINI_API_KEY      — Google AI Studio  (aistudio.google.com/apikey)
//   GROQ_API_KEY        — Groq              (console.groq.com/keys)
//   OPENROUTER_API_KEY  — OpenRouter        (openrouter.ai/keys)
//
// Health check / diagnostics (safe to open in a browser):
//   GET  /api/chat          -> {"ok":true,...}      "the function is deployed"
//   GET  /api/chat?diag=1   -> which keys are set + the REAL upstream error
//   POST /api/chat          -> {"turns":[{"role":"user","content":"..."}]}

const SYSTEM_PROMPT = "تو «مشاور محصولات لوکاتلی» هستی؛ یه فروشنده‌ی باتجربه و خوش‌برخورد توی شوروم لوازم خانگی لوکاتلی که داره با یه مشتری واقعی حرف می‌زنه.\n\n== لحن؛ مهم‌ترین قانون ==\nفارسیِ محاوره‌ای و روزمره بنویس، دقیقاً همون‌طور که یه فروشنده‌ی مؤدب و حرفه‌ای رو در رو حرف می‌زنه. نه کتابی، نه خشک، نه اداری. ولی همیشه با احترام؛ مشتری رو «شما» خطاب کن.\n\nاین شکلی بنویس:\n«می‌تونید» نه «می‌توانید» · «هست» نه «است» · «چیه» نه «چیست» · «می‌خواید» نه «می‌خواهید» · «براتون» نه «برای شما» · «خونه» نه «خانه» · «آشپزخونه» نه «آشپزخانه» · «بگم» نه «بگویم» · «اینا» نه «اینها» · «کوچیک» نه «کوچک» · «می‌شه» نه «می‌شود» · «داره» نه «دارد» · «بذارید» نه «بگذارید» · «اگه» نه «اگر» · «دیگه» نه «دیگر» · «همون» نه «همان» · «توی» نه «در».\n\nاز کلمه‌های طبیعیِ گفتگو استفاده کن: «ببینید»، «راستش»، «حتماً»، «البته»، «به‌نظرم»، «اگه بخواید»، «خیالتون راحت»، «در خدمتم»، «قربان شما»، «چشم».\n\nنمونه‌ی درست:\n«ببینید، اگه آشپزخونه‌تون جای زیادی نداره، مدل J1650 بهترین گزینه‌ست. جمع‌وجوره ولی همون فشار ۲۰ بار رو داره.»\nنمونه‌ی غلط چون خیلی کتابیه:\n«در صورتی که فضای آشپزخانه شما محدود می‌باشد، مدل J1650 گزینه‌ی مناسبی محسوب می‌گردد.»\n\nولی هیچ‌وقت زیادی خودمونی نشو: «داداش»، «عزیزم»، «قربونت» و شوخی‌های اضافه ممنوع. مؤدب و حرفه‌ای بمون؛ محاوره‌ای یعنی صمیمی و روان، نه بی‌ادب.\n\n== بقیه‌ی قواعد ==\n۱. جواب‌ها کوتاه باشه؛ معمولاً سه تا پنج خط، مگه اینکه خود مشتری جزئیات بیشتر بخواد.\n۲. فقط از «اطلاعات محصولات» پایین استفاده کن. چیزی که اونجا نیست از خودت نساز؛ راحت بگو توی کاتالوگ نیومده.\n۳. قیمت، موجودی، زمان ارسال و گارانتی توی این اطلاعات نیست. اگه پرسیدن، بگو با همکارامون تماس بگیرن: ۰۹۱۲۱۷۸۷۳۹۳ یا ۰۹۳۵۹۴۹۶۶۵۹. هیچ‌وقت قیمت حدس نزن.\n۴. وقتی مشتری مرددّه، دو سه تا گزینه رو کوتاه مقایسه کن و آخرش یه پیشنهاد مشخص بده؛ مثل یه فروشنده‌ی خوب، نه مثل یه لیست.\n۵. اسم و مدل کامل محصول رو بگو، مثلاً «اسپرسوساز لوکامیکس مدل VE-369». برند اسپرسوسازها «لوکامیکس»‌ه و بقیه‌ی محصولات «لوکاتلی».\n۶. اگه سؤال مبهمه، یه سؤال کوتاه و مشخص بپرس؛ مثلاً چقدر جا دارن یا چقدر ازش استفاده می‌کنن.\n۷. از ایموجیِ مرتبط استفاده کن، ولی کم و به‌جا — معمولاً یکی دو تا توی هر جواب، فقط جایی که واقعاً به متن ربط داره. مثلاً ☕ برای قهوه و اسپرسوساز، ⚖️ برای ترازو، 🍽️ برای سرویس غذاخوری و ظرف، 🔪 برای چاقو، 🥗 برای آبکش و آماده‌سازی، 🫙 برای ظرف نگهداری، 🎁 برای پیشنهاد هدیه، ✨ برای جمع‌بندی و پیشنهاد نهایی، 👌 برای تأیید. پشت‌سرهم و بی‌دلیل ایموجی نذار و هیچ‌وقت کل جواب رو با ایموجی پر نکن. علامت‌های markdown مثل ستاره و شارپ نذار؛ اگه لازم شد فهرست بدی، هر مورد رو توی یه خط با خط تیره شروع کن.\n۸. اگه سؤال بی‌ربط به آشپزخونه و این محصولات بود، با یه جمله‌ی محترمانه برش گردون سر محصولات.\n۹. خودت رو به‌عنوان هوش مصنوعی معرفی نکن مگه مستقیم بپرسن؛ اون‌وقت راست بگو که دستیار هوشمند فروشگاهی.\n\n== اطلاعات محصولات؛ کاتالوگ لوکاتلی ==\n\n### ترازوی حمامی لوکاتلی  [Digital Glass Bathroom Scale]\nگروه: ۰۱ ترازو و اندازه‌گیری\nصفحه‌ی شیشه‌ی سکوریت و اندازه‌گیری تا ۱۸۰ کیلوگرم با دقت ۵۰ گرم — پیگیری روزانه‌ی وزن، ساده و بی‌دردسر.\n- حداکثر ظرفیت: 180 کیلوگرم\n- دقت توزین: 50 گرم\n- واحد نمایش: کیلوگرم و پوند\n- نوع صفحه: نمایشگر دیجیتال (ساده / نورپردازی LED)\n- جنس صفحه: شیشه سکوریت\n- رنگ‌بندی: مشکی، سفید\nویژگی‌ها: صفحه شیشه سکوریت مقاوم با سطح ضدلغزش | حداکثر ظرفیت 180 کیلوگرم با دقت 50 گرم | نمایشگر دیجیتال با قابلیت نورپردازی LED | نمایش وزن به کیلوگرم و پوند | روشن شدن خودکار با ایستادن روی ترازو | خاموشی خودکار برای صرفه‌جویی در مصرف باتری | موجود در رنگ‌های مشکی و سفید\n\n### ترازوی آشپزخانه لوکاتلی  [Digital Kitchen Scale · SF-400]\nگروه: ۰۱ ترازو و اندازه‌گیری\nهر دستور پخت را دقیق اجرا کنید؛ توزین گرم‌به‌گرم مواد، بدون حدس‌زدن و بدون خطا.\n- مدل: SF-400\n- دقت توزین: 0.1 گرم\n- حداکثر ظرفیت: 5 کیلوگرم\n- نوع حسگر: Strain-Gauge با دقت بالا\n- صفحه نمایش: LCD\n- ویژگی‌های تکمیلی: Tare، خاموشی خودکار، هشدار اضافه‌بار و باتری ضعیف\n- منبع تغذیه: 2 عدد باتری AA\n- نوع بسته‌بندی: کارتن 40 عددی\n- صفر شدن خودکار: دارد\n\n### ترازوی جیبی لوکاتلی  [Digital Pocket Scale · MH-200]\nگروه: ۰۱ ترازو و اندازه‌گیری\nبه‌اندازه‌ی کف دست، با دقتی که در جیب جا می‌شود — توزین دقیق، هر جا که باشید.\n- مدل: MH-200\n- دقت توزین: 0.01 گرم\n- حداکثر ظرفیت: 200 گرم\n- کالیبراسیون: خودکار (Auto Calibration)\n- محدوده Tare: تا حداکثر ظرفیت دستگاه\n- خاموشی خودکار: پس از 30 ثانیه عدم استفاده\n- دمای عملکرد: 10 تا 30 درجه سانتی‌گراد\n- نوع بسته‌بندی: کارتن 100 عددی\n- کاربرد: وزن‌کشی طلا و اجسام ریز\n\n### ترازوی نوت‌بوک لوکاتلی  [Notebook Series Digital Scale]\nگروه: ۰۱ ترازو و اندازه‌گیری\nطراحی تاشو و جمع‌وجور شبیه یک دفترچه؛ توزین دقیق، بدون اشغال فضای کابینت.\n- سری: Notebook Series\n- دقت توزین: 0.1 گرم\n- حداکثر ظرفیت: 2000 گرم\n- واحدهای وزنی: g, oz, ct, gn, ozt, dwt (6 واحد)\n- صفحه نمایش: LCD 5 رقمی\n- ابعاد صفحه توزین: 90×115 میلی‌متر\n- کالیبراسیون: خودکار، از طریق صفحه‌کلید\n- خاموشی خودکار: دارد\n- منبع تغذیه: 2 عدد باتری AAA (همراه محصول)\n- جنس صفحه توزین: استیل ضدزنگ\n\n### ظروف فریزری مربعی لوکاتلی  [Borosilicate Glass Food Container · Set of 6]\nگروه: ۰۴ نگهداری و سرو\nشیشه‌ی بروسیلیکات مقاوم به شوک حرارتی؛ از فریزر تا فر، بدون تعویض ظرف.\n- جنس: شیشه بوروسیلیکات\n- محدوده دما: -40 تا +400 درجه سانتی‌گراد\n- تعداد در ست: 6 عددی\n- شکل‌های موجود: مربعی، مستطیلی، گرد\n- رنگ‌بندی: مشکی، سفید، زرد، سبز\n- شکل: مربعی\n- سایزهای موجود: 0.15 تا 2.2 لیتر (6 سایز)\nویژگی‌ها: مناسب یخچال، فریزر، فر (بدون درب)، مایکروویو و ماشین ظرفشویی | ضدلک، بسیار بهداشتی و مقاوم طبیعی در برابر خوردگی | سطح غیرمتخلخل؛ بدون جذب یا تغییر رنگ | واشر سیلیکونی قابل تعویض، مانع نفوذ هوا و نشتی | موجود در 3 شکل مربعی، مستطیلی و گرد و 4 رنگ مشکی، سفید، زرد و سبز\nجدول: حجم (لیتر) / تعداد در کارتن مادر ؛ 0.15 / 36 ؛ 0.3 / 24 ؛ 0.5 / 18 ؛ 0.8 / 12 ؛ 1.25 / 8 ؛ 2.2 / 6\n\n### پوست‌کن سوییسی لوکاتلی  [Kisag Swiss Peeler · Y-Peeler]\nگروه: ۰۲ آماده‌سازی و سرآشپزی\nتیغه‌ی سوییسی پوست را نازک می‌گیرد و گوشت میوه را نگه می‌دارد؛ کمترین دورریز، سریع‌ترین کار.\n- برند: Kisag (Swiss Made)\n- جنس تیغه: استیل ضدزنگ\n- جنس دسته: پلاستیک بادوام\n- طراحی: ارگونومیک، دوطرفه (راست/چپ‌دست)\n- شست‌وشو: مناسب ماشین ظرفشویی\n- رنگ‌بندی: قرمز، صورتی، مشکی، زرد، آبی، سبز\nویژگی‌ها: تیغه فوق‌تیز و گردان از استیل ضدزنگ برای پوست‌گیری دقیق و بدون اتلاف | طراحی ارگونومیک و متقارن، مناسب برای دست راست و چپ | بدنه سبک و مقاوم، مناسب استفاده روزمره و حرفه‌ای | قابل شستشو در ماشین ظرفشویی | موجود در 6 رنگ متنوع برای سلیقه‌های مختلف\n\n### لگن سه‌تکه استیل لوکاتلی  [Stainless Steel Mixing Bowl Set · With Cover]\nگروه: ۰۲ آماده‌سازی و سرآشپزی\nسه لگن استیل با درپوش؛ از هم‌زدن خمیر تا نگهداری در یخچال، همه در یک ست.\n- جنس: استیل ضدزنگ\n- تعداد در ست: 3 عددی\n- نوع زیر: ساده یا سیلیکونی\n- درب: پلاستیکی، محکم و بهداشتی\n- رنگ‌بندی: مشکی، سبز، کالباسی، زیتونی\nویژگی‌ها: استیل ضدزنگ با کیفیت بالا، مقاوم و بادوام | درب پلاستیکی محکم و بهداشتی برای نگهداری مواد غذایی | زیره سیلیکونی (مدل سیلیکونی)؛ ثبات بیشتر و جلوگیری از سر خوردن | طراحی شیک، مناسب آشپزخانه‌های مدرن | قابل جای‌گیری تودرتو برای نگهداری فشرده در کابینت | موجود در 4 رنگ و دو نوع زیر (ساده / سیلیکونی)\nجدول: قطر / ارتفاع ؛ 20 سانتی‌متر / 9.5 سانتی‌متر ؛ 24 سانتی‌متر / 11.5 سانتی‌متر ؛ 28 سانتی‌متر / 12.5 سانتی‌متر\n\n### لگن چهارتکه استیل لوکاتلی  [Stainless Steel Bowl Set · 4 Pieces With Cover]\nگروه: ۰۲ آماده‌سازی و سرآشپزی\nچهار اندازه در یک ست — برای مخلوط‌کردن، سرو و نگهداری، هرکدام با درپوش اختصاصی.\n- جنس: استیل ضدزنگ\n- تعداد در ست: 4 عددی\n- فرم طراحی: گرد\n- نوع زیر: ساده یا سیلیکونی\n- سایزها: 18، 22، 26 و 30 سانتی‌متر\n- رنگ‌بندی: مشکی، سبز، کالباسی، زیتونی، موکا\nویژگی‌ها: استیل ضدزنگ با پرداخت براق، مقاوم در برابر زنگ‌زدگی و تغییر رنگ | درب‌های محکم و خوش‌ساخت، مانع ورود گردوغبار | موجود با زیره ساده یا سیلیکونی (مقاوم به لغزش) | طراحی گرد و شیک، مناسب انواع آشپزخانه | شامل 4 سایز کاربردی برای پوشش تمام نیازهای روزمره | موجود در 5 رنگ متنوع\nجدول: سایز / قطر ؛ کوچک / 18 سانتی‌متر ؛ متوسط / 22 سانتی‌متر ؛ بزرگ / 26 سانتی‌متر ؛ خیلی بزرگ / 30 سانتی‌متر\n\n### اسپرسو ساز لوکامیکس مدل 1699  [Automatic Espresso Machine · Model 1699 · 1100W]\nگروه: ۰۳ قهوه و نوشیدنی\nپمپ ۲۰ بار ULKA ایتالیا و بدنه‌ی استیل — کرمای غلیظ کافه، روی میز صبحانه‌ی خانه.\n- مدل: 1699\n- توان مصرفی: 1100 وات\n- ولتاژ: 240-220 ولت · 50 هرتز\n- پمپ فشار: ULKA ایتالیا · 20 بار\n- جنس بدنه: استیل ضدزنگ\n- ظرفیت مخزن آب: 1.5 لیتر\n- کاربری: خانگی\n- ابعاد: 30 × 29 × 22 سانتی‌متر\n- بدنه: استیل ضدزنگ، طراحی مدرن و مستحکم\n- انواع قهوه: اسپرسو، کاپوچینو، لاته، ماکیاتو، موکا\nویژگی‌ها: پمپ فشار قوی 20 بار از برند ULKA ایتالیا برای عصاره‌گیری عمیق | بدنه استیل ضدزنگ با طراحی مدرن و مستحکم | قابلیت تهیه انواع قهوه: اسپرسو، کاپوچینو، لاته، ماکیاتو و موکا | سیستم گرم‌کن فنجان برای حفظ دمای ایده‌آل قهوه | سیستم ایمنی کامل، حفاظت از دما و فشار زیاد | همراه با فیلتر تک و دوگانه و همزن اسپرسو (تمپر)\nجدول: حالت فنجان / حجم ؛ تک / 10 + 40 میلی‌لیتر ؛ دوگانه / 15 + 80 میلی‌لیتر\n\n### اسپرسو ساز دیجیتال لمسی لوکامیکس  [Digital Touch Espresso Machine · 1350W]\nگروه: ۰۳ قهوه و نوشیدنی\nپنل تمام‌لمسی با نمایشگر دما؛ همان فنجان دلخواه، با یک لمس و بدون حدس‌زدن.\n- توان مصرفی: 1350 وات\n- ولتاژ: 240-220 ولت · 60/50 هرتز\n- پمپ فشار: ULKA ایتالیا · 20 بار\n- جنس بدنه: استیل ضدزنگ\n- ظرفیت مخزن آب: 1.5 لیتر\n- نوع اسپرسوساز: اسپرسوساز\n- کاربری: خانگی\n- ابعاد: 34 × 30 × 22 سانتی‌متر\n- بدنه: استیل ضدزنگ، طراحی مدرن و مستحکم\n- نمایشگر: پنل لمسی دیجیتال با نمایش دما\nویژگی‌ها: پنل کنترل لمسی دیجیتال با نمایش دما و حالت‌های قهوه | پمپ فشار قوی 20 بار از برند ULKA ایتالیا | بدنه تمام استیل ضدزنگ با طراحی مدرن و مستحکم | قابلیت تهیه انواع قهوه: اسپرسو، کاپوچینو، لاته، ماکیاتو و موکا | سیستم گرم‌کن فنجان برای حفظ دمای ایده‌آل قهوه | سیستم ایمنی کامل، حفاظت از دما و فشار زیاد\nجدول: حالت فنجان / حجم ؛ تک / 10 + 40 میلی‌لیتر ؛ دوگانه / 15 + 80 میلی‌لیتر\n\n### اسپرسو ساز لوکامیکس مدل 1653  [Retro-Style Espresso Machine · Model 1653 · 1350W]\nگروه: ۰۳ قهوه و نوشیدنی\nنمایشگر دایره‌ای رترو و دکمه‌های فلزی — حال‌وهوای کافه‌های قدیمی، با فناوری امروز.\n- مدل: 1653\n- توان مصرفی: 1350 وات\n- ولتاژ: 240-220 ولت · 60/50 هرتز\n- پمپ فشار: ULKA ایتالیا · 20 بار\n- جنس بدنه: استیل ضدزنگ\n- ظرفیت مخزن آب: 1.5 لیتر\n- نوع اسپرسوساز: اسپرسوساز\n- کاربری: خانگی\n- ابعاد: 31 × 28 × 20 سانتی‌متر\n- بدنه: استیل ضدزنگ، طراحی کلاسیک با رویه مشکی\n- نمایشگر: صفحه دیجیتال دایره‌ای با طراحی رترو\nویژگی‌ها: نمایشگر دایره‌ای دیجیتال با طراحی رترو و دکمه‌های فلزی | پمپ فشار قوی 20 بار از برند ULKA ایتالیا | بدنه استیل ضدزنگ با رویه مشکی و طراحی مستحکم | قابلیت تهیه انواع قهوه: اسپرسو، کاپوچینو، لاته، ماکیاتو و موکا | سیستم گرم‌کن فنجان برای حفظ دمای ایده‌آل قهوه | سیستم ایمنی کامل، حفاظت از دما و فشار زیاد\nجدول: حالت فنجان / حجم ؛ تک / 10 + 40 میلی‌لیتر ؛ دوگانه / 15 + 80 میلی‌لیتر\n\n### اسپرسو ساز لوکامیکس مدل VE-369  [Professional Steel Espresso Machine · Model VE-369 · 1350W]\nگروه: ۰۳ قهوه و نوشیدنی\nبدنه‌ی تمام‌استیل و مخزن جداشونده؛ ساخته‌شده برای استفاده‌ی روزانه و پرتکرار.\n- مدل: VE-369-2511668\n- توان مصرفی: 1350 وات\n- پمپ فشار: ULKA ایتالیا · 20 بار\n- جنس بدنه: تمام استیل ضدزنگ\n- مخزن آب: جداشونده · 1.3 لیتر\n- نازل بخار: استیل ضدزنگ\n- نوع اسپرسوساز: چندکاره\n- کاربری: خانگی\n- ابعاد: 31 × 32 × 17 سانتی‌متر\n- بدنه: تمام استیل ضدزنگ، طراحی مدرن و مستحکم\nویژگی‌ها: بدنه تمام استیل ضدزنگ با طراحی مدرن و مستحکم | پمپ اورجینال ایتالیایی ULKA با فشار قوی 20 بار | مخزن آب جداشونده با ظرفیت 1.3 لیتر برای پرکردن آسان | نازل بخار استیل ضدزنگ برای فوم‌گیری شیر | قابلیت تهیه انواع قهوه: اسپرسو، کاپوچینو، لاته، ماکیاتو و موکا | سیستم ایمنی کامل، حفاظت از دما و فشار زیاد | همراه با بسکت سینگل و دبل\nجدول: حالت فنجان / حجم ؛ تک / 10 + 40 میلی‌لیتر ؛ دوگانه / 15 + 80 میلی‌لیتر\n\n### اسپرسو ساز لوکامیکس مدل J1650  [Semi-Automatic Espresso Machine · Model J1650 · 1350W]\nگروه: ۰۳ قهوه و نوشیدنی\nجمع‌وجور برای آشپزخانه‌های کوچک، نیمه‌اتوماتیک برای کسانی که دوست دارند خودشان دم کنند.\n- مدل: J1650\n- توان مصرفی: 1350 وات\n- سیستم دم‌آوری: فشار بخار · 20 بار\n- شیوه عملکرد: نیمه اتوماتیک\n- جنس بدنه: استیل\n- مخزن آب: 1200 میلی‌لیتر\n- نوع اسپرسوساز: چندکاره\n- کاربری: خانگی\n- ابعاد: 31 × 25 × 20 سانتی‌متر\n- بدنه: استیل، صفحه‌نمایش دیجیتال\n- نازل قهوه: دوگانه، امکان تهیه هم‌زمان 1 یا 2 فنجان\nویژگی‌ها: بدنه استیل با صفحه‌نمایش دیجیتال | سیستم دم‌آوری با فشار بخار 20 بار | دو نازل قهوه برای تهیه هم‌زمان 1 یا 2 فنجان | مخزن آب 1200 میلی‌لیتری | همراه با بسکت دبل | امکان تنظیم میزان بخاردهی برای فوم شیر | مناسب استفاده روزمره خانگی\n\n### اسپرسو ساز لوکامیکس مدل 1651  [Semi-Automatic Espresso Machine · Model 1651 · Touch Display]\nگروه: ۰۳ قهوه و نوشیدنی\nدسته‌ی خلبانی و نمایشگر لمسی؛ کنترل کامل روی دم‌آوری، در کم‌ترین فضای ممکن.\n- مدل: 1651\n- سیستم دم‌آوری: فشار بخار · 20 بار\n- شیوه عملکرد: نیمه اتوماتیک\n- مخزن آب: 1500 میلی‌لیتر\n- نوع اسپرسوساز: چندکاره\n- کاربری: خانگی\n- ابعاد: 31 × 27.8 × 42 سانتی‌متر\n- بدنه: دسته خلبانی، صفحه‌نمایش لمسی\n- نازل قهوه: دوگانه، آماده‌سازی هم‌زمان\nویژگی‌ها: دسته خلبانی و صفحه‌نمایش لمسی دیجیتال | سیستم دم‌آوری با فشار بخار 20 بار | دو نازل قهوه برای آماده‌سازی هم‌زمان | مخزن آب 1500 میلی‌لیتری | همراه با بسکت دبل | نازل بخار دستی با قابلیت تنظیم میزان بخاردهی | حفاظت در برابر گرمای بیش از حد\n\n### ست چاقوی آشپزخانه لوکاتلی  [Kitchen Knife Set · German Stainless Steel]\nگروه: ۰۲ آماده‌سازی و سرآشپزی\nفولاد ضدزنگ آلمانی با تیزی ماندگار — برشی تمیز، از خردکردن سبزی تا کار با گوشت.\n- جنس تیغه: استیل ضدزنگ کربن بالا\n- سختی تیغه: 56 تا 58 HRC\n- جنس دسته: پلی‌پروپیلن با هسته فولادی\n- شست‌وشو: دستی (توصیه‌شده)\n- دسته: پلی‌پروپیلن ضدلغزش با هسته فولادی\n- تعداد در ست: 5 عددی، همراه بلوک نگهدارنده\n- رنگ دسته: مشکی، قرمز\nویژگی‌ها: تیغه از استیل ضدزنگ با کربن بالا، تیزی و ماندگاری بیشتر | طراحی full-tang برای تعادل و کنترل کامل در برش | دسته ارگونومیک ضدلغزش، مناسب استفاده طولانی | همراه با بلوک چوبی نگهدارنده برای ایمنی و نظم آشپزخانه | توصیه می‌شود برای حفظ تیزی، به‌صورت دستی شسته شود | طراحی شیک، هماهنگ با سایر محصولات لوکاتلی\nجدول: قطعه / طول تیغه ؛ چاقوی شف / 20 سانتی‌متر ؛ چاقوی برش / 15 سانتی‌متر ؛ چاقوی سبزی / 9 سانتی‌متر ؛ چاقوی نانوا (دندانه‌دار) / 20 سانتی‌متر ؛ قیچی آشپزخانه / —\n\n### آبکش استیل لوکاتلی  [Stainless Steel Colander Set · 6 Pieces · 1000g]\nگروه: ۰۲ آماده‌سازی و سرآشپزی\nشش سایز استیل در یک مجموعه؛ از آبکش‌کردن برنج تا شستن سبزی، هرکدام جای خودش را دارد.\n- جنس: استیل\n- تعداد در ست: 6 عددی\n- وزن: 1000 گرم\n- ابعاد بزرگ‌ترین سایز: 37 × 31 × 11 سانتی‌متر\n- پایه: استیل ضدلغزش\nویژگی‌ها: بدنه استیل، مقاوم در برابر زنگ‌زدگی | سوراخ‌های ریز و یکنواخت برای آبکشی دقیق | پایه استیل ثابت برای قرارگیری مطمئن روی سینک یا کابینت | ست 6 عددی در سایزهای مختلف، پاسخگوی نیازهای مختلف آشپزخانه | وزن سبک مجموعه: 1000 گرم | قابلیت جای‌گیری تودرتو برای نگهداری فشرده\nجدول: سایز / ابعاد (طول × عرض × ارتفاع) ؛ 1 / 37 × 31 × 11 سانتی‌متر ؛ 2 / 34 × 28 × 10 سانتی‌متر ؛ 3 / 30 × 25 × 10 سانتی‌متر ؛ 4 / 28 × 23 × 8 سانتی‌متر ؛ 5 / 24 × 19 × 7 سانتی‌متر ؛ 6 / 21 × 17 × 6 سانتی‌متر\n\n### تفاله‌گیر چای لوکاتلی  [Stainless Steel Tea Strainer]\nگروه: ۰۲ آماده‌سازی و سرآشپزی\nتوری استیل ریزبافت که تفاله را کامل نگه می‌دارد — چای صاف، بدون ته‌نشین.\n- جنس: استیل ضدزنگ\n- نوع توری: ریزبافت\n- دسته: استیل، انتهای حلقه‌ای\n- شست‌وشو: مناسب ماشین ظرفشویی\n- نوع: لبه‌دار، مناسب لیوان و قوری\n- رنگ: استیل، طلایی\nویژگی‌ها: توری ریزبافت استیل برای دم‌آوری یکنواخت و بدون تفاله | طراحی لبه‌دار، مناسب انواع لیوان و قوری | دسته بلند با انتهای حلقه‌ای برای نگهداری و آویزان کردن راحت | بدنه مقاوم در برابر زنگ‌زدگی و حرارت | قابل شستشو در ماشین ظرفشویی | طراحی ظریف و مینیمال، هماهنگ با ست لوکاتلی\n\n### سرویس 26 پارچه ارکوپال لوکاتلی  [Arcopal Dinnerware Set · 26 Pieces · Gold Rim]\nگروه: ۰۴ نگهداری و سرو\n۲۶ پارچه‌ی ارکوپال با لب و طرح طلایی؛ میزی که مهمان را پای آن نگه می‌دارد.\n- جنس: ارکوپال\n- تعداد پارچه: 26 پارچه\n- لبه و طرح: طلایی (لب طلا، نقش طلاکار)\n- شست‌وشو: مناسب ماشین ظرفشویی و مایکروویو\nویژگی‌ها: جنس ارکوپال، سبک و مقاوم در برابر ضربه | لب طلا و طرح طلاکاری‌شده روی بدنه | مجموعه کامل 26 پارچه برای یک سفره کامل | قابل شست‌وشو در ماشین ظرفشویی | قابل استفاده در مایکروویو | موجود در 7 طرح متنوع\nجدول: قطعه / تعداد ؛ بشقاب / 6 عدد ؛ پیش‌دستی / 6 عدد ؛ پیاله / 6 عدد ؛ خورشت‌خوری / 6 عدد ؛ دیس / 1 عدد ؛ کاسه / 1 عدد\n\nاز این‌جا به بعد، پیام‌های بعدی سؤال‌های مشتریه. فقط جواب مشاور رو بنویس.";

// ---------------------------------------------------------------- config ----
const MAX_TURNS = 12;
const MAX_TEXT_BYTES = 4000;
const MAX_OUTPUT_TOKENS = 1200;

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

const GEMINI_MODELS = uniq([
  process.env.GEMINI_MODEL,
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
]);
const GROQ_MODELS = uniq([
  process.env.GROQ_MODEL,
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
]);
const OPENROUTER_MODELS = uniq([
  process.env.OPENROUTER_MODEL,
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
]);

// ------------------------------------------------------------- utilities ----
class UpstreamError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// never let an API key leak into an error message or a diagnostics response
function redact(text) {
  let out = String(text == null ? '' : text);
  for (const name of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY']) {
    const v = process.env[name];
    if (v && v.length > 6) out = out.split(v).join('***');
  }
  return out.slice(0, 600);
}

function keyInfo(name) {
  const v = process.env[name];
  if (!v) return { present: false };
  return { present: true, prefix: v.slice(0, 3), length: v.length };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

// best-effort per-IP throttle (resets whenever the function cools down)
const buckets = new Map();
const WINDOW_MS = 60000;
const MAX_PER_WINDOW = 20;
function rateLimited(ip) {
  const now = Date.now();
  const entry = buckets.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

// ------------------------------------------------------------- providers ----
async function geminiRequest(model, turns, system, maxTokens, extraConfig) {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) +
    ':generateContent';
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({
        role: t.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: t.content }],
      })),
      generationConfig: Object.assign(
        { maxOutputTokens: maxTokens, temperature: 0.7 },
        extraConfig || {}
      ),
    }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    throw new UpstreamError(r.status, (data && data.error && data.error.message) || 'HTTP ' + r.status);
  }
  const cand = data && data.candidates && data.candidates[0];
  const text = ((cand && cand.content && cand.content.parts) || [])
    .map((p) => p.text || '')
    .join('');
  if (!text.trim()) {
    throw new UpstreamError(502, 'empty reply (' + ((cand && cand.finishReason) || 'unknown') + ')');
  }
  return text;
}

// The current Gemini models spend part of the token budget on internal
// "thinking" before they write anything, which can swallow a short answer
// entirely. So: ask for no thinking first; if the model rejects that option or
// still runs out of room, retry once with a much larger budget.
async function callGemini(model, turns, opts) {
  const o = opts || {};
  const system = o.system || SYSTEM_PROMPT;
  const budget = o.maxTokens || MAX_OUTPUT_TOKENS;
  try {
    return await geminiRequest(model, turns, system, budget, {
      thinkingConfig: { thinkingBudget: 0 },
    });
  } catch (err) {
    const msg = String((err && err.message) || '').toLowerCase();
    const optionRejected = err && err.status === 400;
    const ranOutOfRoom = msg.indexOf('max_tokens') !== -1;
    if (!optionRejected && !ranOutOfRoom) throw err;
    return await geminiRequest(model, turns, system, Math.max(budget, 4096), {});
  }
}

async function callOpenAICompatible(cfg, model, turns, opts) {
  const o = opts || {};
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: Object.assign(
      {
        'content-type': 'application/json',
        authorization: 'Bearer ' + process.env[cfg.keyEnv],
      },
      cfg.extraHeaders || {}
    ),
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: o.system || SYSTEM_PROMPT }].concat(
        turns.map((t) => ({
          role: t.role === 'assistant' ? 'assistant' : 'user',
          content: t.content,
        }))
      ),
      max_tokens: o.maxTokens || MAX_OUTPUT_TOKENS,
      temperature: 0.7,
    }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    throw new UpstreamError(r.status, (data && data.error && data.error.message) || 'HTTP ' + r.status);
  }
  const text =
    (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  if (!text.trim()) throw new UpstreamError(502, 'empty reply');
  return text;
}

const GROQ = { url: 'https://api.groq.com/openai/v1/chat/completions', keyEnv: 'GROQ_API_KEY' };
const OPENROUTER = {
  url: 'https://openrouter.ai/api/v1/chat/completions',
  keyEnv: 'OPENROUTER_API_KEY',
  extraHeaders: { 'X-Title': 'Locatelli Catalog' },
};

// every provider/model combination we are allowed to try, in order
function buildAttempts() {
  const attempts = [];
  if (process.env.GEMINI_API_KEY) {
    for (const m of GEMINI_MODELS) {
      attempts.push({ provider: 'gemini', model: m, run: (t, o) => callGemini(m, t, o) });
    }
  }
  if (process.env.GROQ_API_KEY) {
    for (const m of GROQ_MODELS) {
      attempts.push({ provider: 'groq', model: m, run: (t, o) => callOpenAICompatible(GROQ, m, t, o) });
    }
  }
  if (process.env.OPENROUTER_API_KEY) {
    for (const m of OPENROUTER_MODELS) {
      attempts.push({
        provider: 'openrouter',
        model: m,
        run: (t, o) => callOpenAICompatible(OPENROUTER, m, t, o),
      });
    }
  }
  return attempts;
}

async function generate(turns) {
  const attempts = buildAttempts();
  if (attempts.length === 0) {
    throw new UpstreamError(
      500,
      'no API key configured — set GEMINI_API_KEY (or GROQ_API_KEY / OPENROUTER_API_KEY) in the project settings'
    );
  }
  const failures = [];
  for (const a of attempts) {
    try {
      return { text: await a.run(turns), provider: a.provider, model: a.model };
    } catch (err) {
      failures.push(a.provider + '/' + a.model + ': ' + redact(err && err.message));
      // a bad key or a blocked project will fail the same way for every model of
      // that provider, but trying the next provider is still worth it
    }
  }
  throw new UpstreamError(502, failures.join(' | '));
}

// ----------------------------------------------------------- diagnostics ----
async function runDiagnostics() {
  const out = {
    ok: true,
    time: new Date().toISOString(),
    keys: {
      GEMINI_API_KEY: keyInfo('GEMINI_API_KEY'),
      GROQ_API_KEY: keyInfo('GROQ_API_KEY'),
      OPENROUTER_API_KEY: keyInfo('OPENROUTER_API_KEY'),
    },
    promptChars: SYSTEM_PROMPT.length,
    attempts: [],
  };
  const probe = [{ role: 'user', content: 'سلام' }];
  const opts = { system: 'فقط بنویس: سلام', maxTokens: 256 };
  for (const a of buildAttempts()) {
    try {
      const text = await a.run(probe, opts);
      out.attempts.push({ provider: a.provider, model: a.model, ok: true, sample: text.slice(0, 40) });
      break; // first success is enough
    } catch (err) {
      out.attempts.push({
        provider: a.provider,
        model: a.model,
        ok: false,
        status: (err && err.status) || 0,
        error: redact(err && err.message),
      });
    }
  }
  out.working = out.attempts.some((a) => a.ok);
  return out;
}

// -------------------------------------------------------------- handler ----
module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    const url = String(req.url || '');

    // /api/chat?models=1 — the authoritative list for this key
    if (url.indexOf('models') !== -1) {
      if (!process.env.GEMINI_API_KEY) {
        sendJson(res, 200, { ok: false, error: 'GEMINI_API_KEY is not set' });
        return;
      }
      try {
        const r = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
          { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } }
        );
        const d = await r.json().catch(() => null);
        sendJson(res, 200, {
          ok: r.ok,
          status: r.status,
          usable: ((d && d.models) || [])
            .filter((m) => (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1)
            .map((m) => String(m.name).replace('models/', '')),
          error: d && d.error ? redact(d.error.message) : undefined,
        });
      } catch (e) {
        sendJson(res, 200, { ok: false, error: redact(e && e.message) });
      }
      return;
    }

    const wantsDiag = url.indexOf('diag') !== -1;
    if (!wantsDiag) {
      sendJson(res, 200, {
        ok: true,
        endpoint: '/api/chat',
        hint: 'POST {"turns":[{"role":"user","content":"..."}]} — add ?diag=1 to test the API key',
      });
      return;
    }
    try {
      sendJson(res, 200, await runDiagnostics());
    } catch (err) {
      sendJson(res, 500, { ok: false, error: redact(err && err.message) });
    }
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown')
    .split(',')[0]
    .trim();
  if (rateLimited(ip)) {
    sendJson(res, 429, { error: 'rate_limited', message: 'تعداد درخواست‌ها زیاد شد. یک دقیقه صبر کنید.' });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    sendJson(res, 400, { error: 'invalid_json' });
    return;
  }

  const raw = Array.isArray(body && body.turns) ? body.turns : null;
  if (!raw || raw.length === 0) {
    sendJson(res, 400, { error: 'invalid_request', message: 'turns must be a non-empty array' });
    return;
  }

  const turns = raw.slice(-MAX_TURNS).map((t) => ({
    role: t && t.role === 'assistant' ? 'assistant' : 'user',
    content: String((t && t.content) || '').slice(0, MAX_TEXT_BYTES),
  }));
  if (turns[turns.length - 1].role !== 'user') {
    sendJson(res, 400, { error: 'invalid_request', message: 'last turn must be from the user' });
    return;
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();

  let result;
  try {
    result = await generate(turns);
  } catch (err) {
    sendJson(res, (err && err.status) || 502, {
      error: 'upstream_error',
      message: redact(err && err.message),
    });
    return;
  }

  // stream the answer out in small pieces so the bubble fills in progressively.
  // the whole typing effect is capped at ~1.2s so a long answer can never push
  // the function past its execution limit.
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  const text = result.text;
  const size = 12;
  const pieces = Math.ceil(text.length / size) || 1;
  const delay = Math.min(14, Math.floor(1200 / pieces));
  for (let i = 0; i < text.length; i += size) {
    res.write(text.slice(i, i + size));
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }
  res.end();
};
