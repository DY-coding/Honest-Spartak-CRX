document.addEventListener("DOMContentLoaded", async ()=>{
	
	const syncData = await chrome.storage.sync.get(['Enabled', 'blackWords']);
	let Enabled = syncData.Enabled ?? true;
	if(syncData.Enabled === undefined){
			chrome.storage.sync.set({Enabled : true});
	}
	const blackList = syncData.blackWords || [];

	const container = document.getElementById("container");
	const fragment = document.createDocumentFragment();
	const header = document.getElementById('header');
	const title = document.getElementById("title");
	const save = document.getElementById('saveButton');
	const add = document.getElementById('addButton');
	const input = document.getElementById('inputField');
	const switcher = document.getElementById('checkbox');
	const OnOff = document.getElementById('OnOff');


	[...blackList].sort().forEach(item =>{
		fragment.append(createWordElement(item));
	});
	container.append(fragment);

	let amount = blackList.length;
	title.textContent = `Черный список (${amount})`;

	container.addEventListener('click', (event) =>{
		const btn = event.target.closest('.buttonX');
		if(!btn) return;

		const wrapper = btn.closest('.wrapper');
		wrapper.classList.add('delete');
		setTimeout(() => {
			wrapper.remove();
			title.textContent = `Черный список (${--amount})`;
			save.classList.remove('inactive');
		}, 1000);
	})


	switcher.checked = Enabled;
	UpdateUIState(Enabled);


	save.addEventListener('click', async ()=>{
		if(save.classList.contains('inactive')) return;
		
		const blackWords = Array.from(container.querySelectorAll('.blackWord')).map(item => item.textContent);

		chrome.storage.sync.set({blackWords});
		save.classList.add('inactive');

	});


	
	add.addEventListener('click', () => {
		const val = input.value.trim();
		if(val === ""){
			input.value = "";
			input.classList.remove('empty');
			void input.offsetWidth;
			input.classList.add('empty');
			setTimeout(()=> {input.classList.remove('empty')}, 600);
			return;
		}
		const doublet = Array.from(container.querySelectorAll('.blackWord')).find(item => item.textContent.toUpperCase() === val.toUpperCase());
		if(doublet){
			doublet.classList.add('shake');
			setTimeout(() => {doublet.classList.remove('shake')}, 600);
			input.value = "";
			return;
		}
		
		container.append(createWordElement(val, true));

		input.value = "";
		title.textContent = `Черный список (${++amount})`;
		save.classList.remove('inactive');

	});

	input.addEventListener('keydown', (event) =>{
		if(event.key === 'Enter'){
			event.preventDefault();
			add.click();
		}
	});

	switcher.addEventListener('change', async function() {

		Enabled = !Enabled;
	
		UpdateUIState(Enabled);

		chrome.storage.sync.set({Enabled});

	});


});


function UpdateUIState(isActive){

		OnOff.textContent = isActive ? "I"  : "0";
		document.body.classList.toggle('faded', !isActive);
		header.querySelectorAll('button').forEach(el =>{
			el.disabled = !isActive;
		});

}


function createWordElement(text, popup=false){
	
	const wrapper = document.createElement('div');
	wrapper.classList.add('wrapper');
	const word = document.createElement('div');
	word.classList.add('blackWord');
	if(popup){
		word.classList.add('new');
		setTimeout(()=> word.classList.remove('new'),1000);
	}
	word.textContent = text;
	const button = document.createElement('button');
	button.classList.add('buttonX');
	button.textContent = '×';

	wrapper.append(word, button);
	return wrapper;
}