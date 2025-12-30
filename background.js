import { blackUrls, blackListRaw } from './constants.js';
const blackList = blackListRaw.map(item => item.toUpperCase());
let timeoutId = null;

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



chrome.action.onClicked.addListener(() => {
	chrome.tabs.query({active:true, currentWindow:true}, tabs => {
		chrome.tabs.update(tabs[0].id, { url: "https://www.sports.ru/football/club/spartak/"});
	});
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	switch (request.action) {
		// отправка по запросу контент-скрипта черного списка, т.к. import в контент-скрипте не работает
		case 'getBlackLists':
				sendResponse({blackUrls, blackList});
				break;
		case 'setBadgeText':
				chrome.action.setBadgeText({text: request.value});
				break;
		case 'setTooltip':
				chrome.action.setTitle({title: request.value});			
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

	const result = await chrome.storage.local.get('keyReads');
	const reads = Array.isArray(result.keyReads) ? result.keyReads : [];
	
	console.log(reads);

	try {
		const response = await fetch('https://www.sports.ru/football/club/spartak/');
		if(!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
	
		const text = await response.text();
		const startIndex = text.indexOf('<div class="newsline">');
		const endIndex = text.indexOf('<a href="#">Показать еще</a>', startIndex);
		let cut;
		if(startIndex !==-1 && endIndex !==-1)	cut = text.substring(startIndex, endIndex);
		else 	cut = text;
		console.log(cut);
		if (cut.length) console.log(`Урезка в ${text.length/cut.length} раз.`);
	
		const matchResult = cut.matchAll(/<p><span class="date">(?<time>[^<]+)<\/span>&nbsp;<a class="short-text" href="(?<url>[^"]*?(?<id>\d+)[^"]*?\.html)">(?<text>[^<]+)<\/a/gi);
		let countUnread = 0;
		let info = '';
		let allTrueNews = 0;
		for(const match of matchResult){

			// замена обозначения тире на самое тире
			const textCorrected = match.groups.text.replace(/&ndash;/g, "–");
	
	 		if( blackUrls.some(black => match.groups.url.includes(black)) ) continue;
	 		if( blackList.some(black => textCorrected.toUpperCase().includes(black)) ) continue;
			++allTrueNews;
		
			if(reads.some(item => textCorrected === item)) continue;

	 		++countUnread;
		 	info += (match.groups.time + '.' + textCorrected.slice(0,90) + "…" + '\n');
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