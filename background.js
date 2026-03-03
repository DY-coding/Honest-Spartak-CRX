let timeoutId = null;
let Enabled;
let blackList = [];
let blackUrls = [];

// черный список
const dataReady =  (async () => {
	const syncData = await chrome.storage.sync.get(['Enabled', 'blackWords']);
	Enabled = syncData.Enabled ?? true;
	if(syncData.Enabled === undefined){
			chrome.storage.sync.set({Enabled : true});
	}
	blackUrls = Enabled ? ["sirena.world", "t.me/sirena", "blogs", "cyber.sports", "anketolog", 
							"/betting/", "/predictions/", "video.sports.ru", "specials"] : [];
	blackList = Enabled ? (syncData.blackWords || []) : [];
})();



chrome.action.setBadgeBackgroundColor({ color: '#F08080' });

self.addEventListener('install', event => {
	self.skipWaiting();
});


self.addEventListener('activate', event => {
	event.waitUntil(
		(async () => {
			await checkUnread();

			const alarm = await chrome.alarms.get('periodics');
			if(!alarm) {
				chrome.alarms.create('periodics', {periodInMinutes: 15});
			}

			await self.clients.claim();
		})());
});


// обновление данных при загрузке браузера
chrome.runtime.onStartup.addListener(async ()=> {
		await checkUnread();
});


// реакция на изменение черного списка
chrome.storage.onChanged.addListener((changes, area) =>{
	if(area === 'sync'){
		if(changes.Enabled)
			Enabled = changes.Enabled.newValue;
		if(changes.blackWords)
			blackList = changes.blackWords.newValue;
	}
});

chrome.action.onClicked.addListener(() => {
	chrome.tabs.create({
		url: "https://www.sports.ru/football/club/spartak/",
		active: true

	});
});



chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
	switch (request.action) {
		case 'setBadgeText':
				chrome.action.setBadgeText({text: request.value});
				break;
		case 'setTooltip':
				let newTooltip = "", oldTooltip = "";
				const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
				if(tab){
					oldTooltip = await chrome.action.getTitle({tabId: tab.id}) || "";
				}
				const matching = oldTooltip.match(/(◆.*◆)/s);
				if(matching){
					newTooltip = matching[0];
				}
				chrome.action.setTitle({title: newTooltip || request.value});			
				break;
	}
	return true;
});


chrome.alarms.onAlarm.addListener(async alarm => {
	if(alarm.name === 'periodics') {
			await checkUnread();
	}
});


async function checkUnread() {

	if(Enabled) await dataReady;

	const result = await chrome.storage.local.get('keyReads');
	const reads = Array.isArray(result.keyReads) ? result.keyReads : [];
	
	console.log("====")
	console.log('Считано из локального хранилища (прочитанное):');
	console.log(reads);
	console.log("====")



	try {
		const response = await fetch('https://www.sports.ru/football/club/spartak/');
		if(!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
	
		const text = await response.text();
		

		let nextMatch = '';
		const start = text.indexOf(`<div class="score score-gray">`);
		if(start !== -1){

			const chunk = text.substring(start, start + 1500);
			const regex = new RegExp(
				`itemprop="name">` + 
				`\\s*(?<home>[^<]+?)\\s*</span>` +
				`.*?itemprop="name">` +
				`\\s*(?<away>[^<]+?)\\s*</span>` +
				`.*?</div>`+
				`\\s*0*(?<time>[^<]+?)\\s*<a` + 
				`.*?">` + 
				`\\s*(?<type>[^<]+?)\\s*</a>`,
				`s`
			);
			const match = chunk.match(regex);

			const targetDate = match.groups.time.match(/\d+ \S+/);
			const now = new Date();
			
			let j = 0;
			while(1){
				const day = new Date(now);
				day.setDate(now.getDate() + j);

				if(targetDate[0] === day.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'})) {
					switch(j) {
						case 0: nextMatch = '◆ СЕГОДНЯ ';
								break;
						case 1: nextMatch = `◆ ЗАВТРА `;
								break;
						case 2: nextMatch = `◆ ПОСЛЕЗАВТРА `; 
								break;
						default:
								nextMatch = `◆ ${day.toLocaleDateString('ru-RU', {weekday: 'long'}).toUpperCase()} `;
								break;
					}
					break;
				}
				if(j++>400) break;
			}

			nextMatch += `◆ ${match.groups.time} ◆ ${match.groups.home} - ${match.groups.away} (${match.groups.type}) ◆\n\n`;
		}


		let cut;
		const startIndex = text.indexOf('<div class="newsline">');
		const endIndex = text.indexOf('<a href="#">Показать еще</a>', startIndex);
		if(startIndex !==-1 && endIndex !==-1)	cut = text.substring(startIndex, endIndex);
		else 	cut = text;
		if (cut.length) console.log(`Урезка в ${text.length/cut.length} раз.`);
	
		const matchResult = Array.from(cut.matchAll(/<p><span class="date">(?<time>[^<]+)<\/span>&nbsp;<a class="short-text" href="(?<url>[^"]*?(?<id>\d+)[^"]*?\.html)">(?<text>[^<]+)<\/a/gi));
		
		console.log('Считано из сети(с новыми:)');
		const readed = [];
		matchResult.forEach(item => readed.push(item[4]));
		console.log({readed});
		

		let countUnread = 0;
		let info = nextMatch;
		let allTrueNews = 0;
		for(const match of matchResult){

			// замена обозначения тире на самое тире
			const textCorrected = match.groups.text.replace(/&ndash;/g, "–");
	
	 		if(Enabled){
	 			if( blackUrls.some(black => match.groups.url.includes(black)) ) continue;
	 			if( blackList.some(black => textCorrected.toUpperCase().includes(black.toUpperCase())) ) continue;
	 		}
			++allTrueNews;
		
			if(reads.some(item => textCorrected === item)) continue;

	 		++countUnread;
		 	info += (match.groups.time + ' ' + textCorrected.slice(0,90) + "…" + '\n');
		}

		console.log('Непрочитанных новостей: '+ countUnread + ' штук.');
		
		chrome.action.setTitle({title: info || "Честный Спартак"});
		chrome.action.setBadgeText({
			text: countUnread > 0 ? `${countUnread}${countUnread === allTrueNews ? "+" : ""}` : ""
		});

	}
	catch(error) {
		console.log('Ошибка фетчинга: ',error);

		tryAnotherOne(20000);
	}
}


function tryAnotherOne(delayInMsecs) {

	if(timeoutId) return;

	timeoutId = setTimeout( async ()=> {
		timeoutId = null;
		await checkUnread();
	}, delayInMsecs);
}
