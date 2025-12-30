// РУБИЛЬНИК черного списка
let ENABLED = true;//false;
let blackUrls = [];
let blackList = [];
let newsTotal = 0;
let trueNewsTotal = 0;

// ОБРАБОТКА ДИНАМИЧЕСКИ ПОДГРУЖАЕМЫХ НОВОСТЕЙ
const observer2 = new MutationObserver( records =>{
			//console.log("::====== Количество MutationRecord " + records.length + " ==========");
			records.forEach((record, index) =>{
				//console.log("::В MutationRecord[" + index + "] было добавлено " + record.addedNodes.length + " узлов, " +
		  		//				"а удалено " + record.removedNodes.length + " узлов");
			    record.addedNodes.forEach((node, jndex)=>{
	  				if(node.nodeType === Node.ELEMENT_NODE){
	  			 		//console.log("::--Под номером " + jndex + " добавлен html узел " + node + ":");
		  			    //console.log(node);
 		  			    if(node.tagName.toLowerCase() === 'aside'){
	   				    	//console.log(':: ЭТО РЕКЛАМА 18 ASIDE');
	   				    	node.classList.add('hidden');
 	  				    }   
 	  			    	if(node.classList.contains('nl-item')){
							//console.log("::Это блок новостей");
		  					const addedNews = node.querySelectorAll('.short-text');
	  			  			if(addedNews){
								//console.log("::...и в нем " + addedNews.length + " новостей.");
	  			  				addedNews.forEach(news =>{
			  						// интегрированое в цикл сокрытие рекламных текстов 
									const href = news.getAttribute('href');
									if(href && blackUrls.some(match => href.includes(match))){
										const parent = news.parentNode;
										if(parent) parent.classList.add('hidden');
										++newsTotal;
										return;
									}

	  			  					if(isTrueNews(news, blackList))		++trueNewsTotal;
	  			  					++newsTotal;

									// и подчистка новости от ссылки на комментарии
									const span =  news.nextElementSibling;
									if(span && span.classList.contains('sp')) span.classList.add('hidden');
									const comments = span.nextElementSibling;
									if(comments && (comments.tagName.toLowerCase() === 'a')) comments.classList.add('hidden');
		  			  			});
		  			  		}

							// убрать пустой блок без новостей
							const flag = node.querySelector('p:not(.hidden)');
							if(!flag){ 
								node.classList.add('hidden');
								//console.log(":: Блок новостей пуст!");
							}
		  			 	}
		  			}
					// 		else {console.log(":::--Под номером " + jndex + " добавлен НЕ НОД:"); console.log(node);}
			    });
			});

    		// и обновить блок информации
    		updateInfo(trueNewsTotal, newsTotal);
});


// запрос черного списка, т.к. import в контент-скрипте не работает
chrome.runtime.sendMessage({action: "getBlackLists"}, async (response) =>{
	if(response){ // НАЧИНАЕМ ФИЛЬТРАЦИЮ ТОЛЬКО ПОСЛЕ ПОЛУЧЕНИЯ ОТВЕТА ОТ СЕРВИС-ВОКЕРА
		newsTotal = 0;
		trueNewsTotal = 0;
		if(ENABLED){
					blackList = response.blackList;
					blackUrls = response.blackUrls;
		}
		console.log(blackList);
		console.log(blackUrls);


		// обсервер
		const newsLine = document.querySelector('.newsline');
		if(newsLine) observer2.observe(newsLine, {childList:true});

		let prevReads = (await chrome.storage.local.get('keyReads')).keyReads;
		if(!prevReads) prevReads = []; // если хранилище пусто

		//////////////// ФИЛЬТРАЦИЯ НОВОСТЕЙ ///////////////////
		// создание общего списка и сокрытие по блоклисту
		const allNews = document.querySelectorAll('.short-text');
		if(allNews.length > 0)
			allNews.forEach(element =>{
			
				// сокрытие рекламных текстов
				const href = element.getAttribute('href');
				if(href && blackUrls.some(match => href.includes(match))){
					element.parentNode.classList.add('hidden');
					++newsTotal;
					return;
				}

				// основная фильтрация загруженной страницы
				if(isTrueNews(element, blackList)){
						++trueNewsTotal;
						console.log(element.textContent);

						if(!prevReads.some(item => (element.textContent === item))) element.classList.add('unread');
						else element.classList.remove('unread');
						
						console.log(prevReads);
				}
				++newsTotal;

				// и подчистка новости от ссылки на комментарии
				const span =  element.nextElementSibling;
				if(span && span.classList.contains('sp')) span.classList.add('hidden');
				const comments = span?.nextElementSibling;
				if(comments && (comments.tagName.toLowerCase() === 'a')) comments.classList.add('hidden');

			});


		// убрать пустые блоки без новостей
		const newsBlock = document.querySelectorAll('.nl-item');
		if(newsBlock.length > 0)
			newsBlock.forEach(element =>{
				const flag = element.querySelector('p:not(.hidden)');
				if(!flag) element.classList.add('hidden');
		});


		// результат фильтрации в блок информации
		updateInfo(trueNewsTotal, newsTotal);


		// получение идентификаторов всех новостей
		
		const reads = [];
		for(const news of allNews)
			if(!news.parentNode.classList.contains('hidden')){
				
				//console.log(news);
				const id = news.getAttribute('href').match(/^\/\D+\/(\d+)-.+$/);
				if(id) {
					//console.log('СОХРАНЯЕМ заголовок: ' + news.textContent);
					reads.push(news.textContent);
				}
			}


		chrome.storage.local.set({keyReads: reads});
	
		// обнуляем непрочитанные новости 
		chrome.runtime.sendMessage({action: "setBadgeText", value: ""});
		chrome.runtime.sendMessage({action: "setTooltip", value: "Честный Спартак"});

		//console.log(times);
		//console.log(ids);
		console.log(reads);
	




		///////////// ОТОБРАЖЕНИЕ СОДЕРЖИМОГО НОВОСТИ

		// предварительное создания блокирующего окно оверлея и знак загрузки (пока невидимых)
		const overlayBlock = document.createElement('div');
		overlayBlock.classList.add('block-overlay');
		const loadingSign = document.createElement('div');
		loadingSign.classList.add('loading');
		document.body.appendChild(overlayBlock);
		overlayBlock.appendChild(loadingSign);
	



		// делегированный обработчик по всем ссылкам новостей через контейнер, 3-мя уровнями выше
		if(newsLine)
			newsLine.addEventListener('click', event =>{
				event.preventDefault();
				if(event.target.classList.contains('short-text')){

					// блокируем оверлеем окно и отображаем процесс загрузки
					overlayBlock.classList.add('overlay-show');
					loadingSign.classList.add('loading-show');
					// и прокрутку колесиком (плюс учет смещения от пропадания скроллбара)
					scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
					// console.log(`: : : innerW=${window.innerWidth} clientW=${document.documentElement.clientWidth} barW=${scrollBarWidth}`);
	    			document.body.style.setProperty('--scrollbar-width', `${scrollBarWidth}px`);
	    			document.body.classList.add('body-locked');

					const url = event.target.getAttribute('href');
					if(url){
						fetch(url)
						.then(response =>{
							if(!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
							return response.text();
						})
						.then(html =>{

							const doc = new DOMParser().parseFromString(html, 'text/html');
							let output = "";
							const firstParagraph = doc.querySelector('.news-content__first-paragraph');
							if(firstParagraph) output = firstParagraph.innerHTML + "<p class='empty-line'></p>";
							const otherParagraphs = doc.querySelector('.structured-body-wrapper.news-content__structured-body-wrapper');
							if(otherParagraphs){
								const paragraphs = otherParagraphs.querySelectorAll('.sb-paragraph.sb-paragraph--regular');
								if(paragraphs)
										paragraphs.forEach((element,index,nodelist) =>{
												const a = element.querySelector('a');
												if((a === null) || (a.textContent !== element.textContent)) 
																output +=element.innerHTML;
												if(index !== (nodelist.length-1)) output += "<p class='empty-line'></p>";
										});
							}
							// вызов функции
							let preview_box = showNews(event, output, overlayBlock);
							loadingSign.classList.remove('loading-show');

						})
						.catch(error =>{
							console.error('::Ошибка при загрузке новости: ', error);
							showNews(event, 'Ошибка загрузки!', overlayBlock);
						});
					}		
				}
			});

	}
});





//////////////// УДАЛЕНИЕ ЛИШНИХ ЭЛЕМЕНТОВ /////////////////
// удаление "поп-ап" предупреждения о наличии блокировщика
const antiAdblockObserver = new MutationObserver( records => {
	for(const record of records){
		for(const node of record.addedNodes){
			if(node.nodeType !== Node.ELEMENT_NODE) continue;
			if(node.tagName === 'DIV'){
				const cls = node.className;
				if(cls.length === 33 || cls.length === 67 ){
					node.classList.add('hidden');
					console.warn("BLOCK");
				}
				// учет wrapper-а
				const child = node.firstElementChild;
				if(!child || child.nodeType !== Node.ELEMENT_NODE) continue;
				if(child.tagName === 'DIV'){
					const cls = child.className;
					if(cls.length === 33 || cls.length === 67 ){
						node.classList.add('hidden');
						console.warn("BLOCK");
					}
				}
			}
		}
	}
});
antiAdblockObserver.observe(document.body, { childList:true, subtree: true });



// замена блока подписки на блок статистики фильтрации
{const signing = document.querySelector('.sign-up-block--flex.sign-up-block--center');
if(signing){
	signing.classList.add('info');
	signing.innerHTML = "";
	
	const createP = (text="", id=null)=>{
		const element = document.createElement('p');
		if(text) element.textContent = text;
		if(id) element.id = id;
		return element;
	}
	const createDiv = (...classes) =>{
		const element = document.createElement('div');
		element.classList.add(...classes);
		return element;
	}

	const firstLineInfo = createP("", 'first-line-info');
	const secondLineInfo = createP("из них");
	const thirdLineInfo = createP("",'third-line-info');
	const fourthLineInfo = createDiv('empty-line');
	const fifthLineInfo = createDiv('bar');
	const insideLineA = createDiv('bar-fill', 'bar-truth');
	const insideLineB = createDiv('bar-fill', 'bar-hoax');

	fifthLineInfo.append(insideLineA, insideLineB);
	signing.append(firstLineInfo, secondLineInfo, thirdLineInfo, fourthLineInfo, fifthLineInfo);
	}
}


const firstLine = document.getElementById('first-line-info');
const thirdLine = document.getElementById('third-line-info');


// удаление красной точки у ЧАТА
{const chatPointParent = document.querySelector('[data-id="chat"]');
if(chatPointParent){
	const chatPoint = chatPointParent.querySelector('span');
	if(chatPoint) chatPoint.classList.add('hidden');
}
}


//////////////// РАССТАНОВКА ГАЛОЧЕК ВЫБОРА /////////////////

// выбор якоря <a> - ВСЕ новости
{const filter = document.querySelector('.sm:not(.sm-act)');
if(!filter) console.log("НЕ НАЙДЕН ЯКОРЬ!");
if(filter && filter.textContent === "Все") filter.click();}

// выбор чекбокса - только НОВОСТИ
{const checks = document.querySelectorAll('input[type="checkbox"]');
if(!checks) console.log("НЕ НАЙДЕН ЯКОРЬ!");
if(checks.length >= 3)
	checks.forEach( (element, index) => {
		element.nextElementSibling.textContent = '       ' + element.nextElementSibling.textContent;
		if(element.value === "news" && !element.checked) element.click();
		if(element.value === "article" && element.checked) element.click();
		if(element.value === "blog" && element.checked)  element.click();
	});}


//////////////// ДОБАВЛЕНИЕ ИНФОРМАЦИИ /////////////////

// Трофеи
{const description = document.querySelector('.descr');
if(description){
	description.innerHTML = `<span style="width: 120px; display: inline-block;" id="description1"></span><span style="display: inline-block; width: 50px;" id="description2"></span><span style="display: inline-block; width: 10px;" id="description3"></span>`;
	const description1 = description.querySelector('#description1');
	description1.textContent = `FC Spartak Moscow`;
	const description2 = description.querySelector('#description2');
	description2.textContent = `Чемпион`;
	const description3 = description.querySelector('#description3');
	description3.textContent = "2017·01·00·99·98·97·96·94·93·92·89·87·79·69·62·58·56·53·39·38·36";

}}

// Результаты последних матчей
{const container = document.querySelector('.matches-img');
let result = [];
if(container){
	const matches = container.querySelectorAll('a');
	matches.forEach((j,i) =>{
//		console.log("::" + j.title);
		result[i] = j.title.toUpperCase();
	});
}

const centerBlock = document.querySelector('.img-box');
const matchesDiv = document.createElement('div');

let match = [];
result.slice(0,result.length-1).reverse().forEach((element, index) =>{
	match[index] = document.createElement('div');
	const reformatted = reFormat(element);
	if(reformatted !== null) match[index].innerHTML = reformatted;
	else console.log('DID NOT FORMAT');
	match[index].classList.add('last-matches');
	matchesDiv.append(match[index]);
});

matchesDiv.classList.add('history');
centerBlock.appendChild(matchesDiv);
}


///////////////// ФУНКЦИИ ////////////////////////////// 
// функция: перформатирование строки предыдущего матча
function reFormat(str){
	
	if(!str) return null;

	let match = str.match(/^\s*(.+?)\s*[–-]\s*(.+?)\s*(\d+\s*:\s*\d+)\s*$/);
	if(!match) return null;

	if(match[2].length > 15) match[2] = match[2].slice(0,11) + "…";
	if(match[1].length > 15) match[1] = match[1].slice(0,11) + "…";

	return ("<span style='width: 100px; text-align: right;'>" + match[1] + 
			    "</span><span style='width: 30px; font-family: monospace; text-align: center;'>" + match[3].replaceAll(/\s/g, '') + 
			    "</span><span style='width: 100px; text-align: left;'>" + match[2] + "</span>");

}


 // функция: проверка конкретной новости на черный список
 function isTrueNews(news, black_list){
		for(const stopWord of black_list)
			if(news.textContent.toUpperCase().includes(stopWord)){
				const parent = news.parentNode;
				parent.classList.add('hidden');
				return false;
			}
		return true;
 }

 

 // функция: всплывающая новость по щелчку мыши	
 function showNews(event, content, overlayBlock){

	// кнопка закрытия
	const closeButton = document.createElement('button');
	closeButton.classList.add('button-close');
	
	// контейнер прокручиваемого контента
	const scrollableContent = document.createElement('div');
	scrollableContent.classList.add('scrollable');
	scrollableContent.innerHTML = content;

	// подготовка модального окна
	const previewBox = document.createElement('div');
	previewBox.classList.add('popup-news');
	previewBox.appendChild(scrollableContent);		
	previewBox.appendChild(closeButton);		
 	document.body.appendChild(previewBox);
	
 	//  реальную высоту кнопки после добавления в DOM
	const buttonHeight = closeButton.offsetHeight;

	// уборка полосы прокрутки за ненадобностью
	if((scrollableContent.scrollHeight+14) < previewBox.clientHeight){ 
			scrollableContent.style.overflowY = "hidden";
			closeButton.style.left = "625px";
	}
	else 	scrollableContent.style.overflowY = "auto";
	
	scrollableContent.style.maxHeight = `calc(${previewBox.clientHeight}px - 60px)`;
	scrollableContent.style.marginTop = `-${buttonHeight}px`;


	
	// Закрытие по фону
	function onOverlayClick(){
		if(previewBox && previewBox.checkVisibility()){
			closePreview();
		}
	}
	// закрытия по кнопке
	function onCloseButtonClick(){
			closePreview();
	}
	// закрытия по escape
	function onEscape(e){
		if(e.key === 'Escape'){
			closePreview();
		}
	}

	// обработчики закрытия новости
	overlayBlock.addEventListener('click', onOverlayClick);
	closeButton.addEventListener('click', onCloseButtonClick);
	window.addEventListener('keyup', onEscape);


    function closePreview(){
		previewBox.remove();
		overlayBlock.classList.remove('overlay-show');
		document.body.classList.remove('body-locked');

		overlayBlock.removeEventListener('click', onOverlayClick);
		closeButton.removeEventListener('click', onCloseButtonClick);
		window.removeEventListener('keyup', onEscape);
 	}

	return previewBox; // ссылка на окно новости
}

	



 // функция обновления блока информации 
 function updateInfo(true_news_total, news_total){
		// затираем блок подписки своим блоком информации
		const info = document.querySelector('.info');
  	if(info){
			if(firstLine) firstLine.textContent = `Всего ${news_total} новостей`;
			if(thirdLine) thirdLine.textContent = `${true_news_total} честных`;
			// полоска
  			const barTruth = document.querySelector('.bar-fill.bar-truth');
  			const barHoax = document.querySelector('.bar-fill.bar-hoax');
  			if(barTruth) barTruth.style.width = `${true_news_total/news_total*100}%`;
  			if(barHoax) barHoax.style.width = `${(news_total-true_news_total)/news_total*100}%`;
		}
 }		


//////////// УСТАНОВКА ОБСЕРВЕРОВ МУТАЦИЙ ////////////////////

// удаление нижнего меню, появляющегося динамически при изменении размеров окна браузера
const observer1 = new MutationObserver(records => {
//	console.log(`::=== Количество объектов MutationRecord ${records.length} ===`);
	  records.forEach((record, i) => {
//  			console.log(`::[${i}]. Количество добавленных узлов в MutationRecords[${i}] равно ${record.addedNodes.length}`);
//  			console.log(`::[${i}]. Количество удаленных узлов в MutationRecords[${i}] равно ${record.removedNodes.length}`);
	  			record.addedNodes.forEach((node,j) =>{
	  					if(node.nodeType === Node.ELEMENT_NODE) {
//  					    console.log(`::[${i}][${j}]. Узел[${j}] - это элемент и он является: ${node}:`);
//  					    console.log(node);
	  					    if(node.classList.contains('navigation-navbar-mobile'))		node.classList.add('hidden');
	  					}
//  					else console.log(`::[${i}][${j}]. Узел[${j}] - это НЕ элемент и он является: ${node}`);
	  			});
	  });
}); 
const navigationMountPoint = document.querySelector('#navigation-mount-point');
if(navigationMountPoint)  observer1.observe(navigationMountPoint, {childList:true});
