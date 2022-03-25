const { Bot, session } = require('grammy')
const { MenuTemplate, MenuMiddleware, createBackMainMenuButtons } = require('grammy-inline-menu')
const { StatelessQuestion } = require('@grammyjs/stateless-question')
const { I18n } = require('@grammyjs/i18n');
const CryptoJS = require("crypto-js")
const userModel = require('./src/models/user.model')
const hometaskModel = require('./src/models/hometask.model')
const noteModel = require('./src/models/note.model')
require('dotenv').config()

const DELETED_STATUS = 0
const ACTIVE_STATUS = 10
const DONE_STATUS = 20

const i18n = new I18n({
	defaultLanguageOnMissing: true,
	directory: "locales",
	useSession: true,
})

const initial = () => {
	return {
		isUserExist: false,
		isAdmin: true,
		selectedNote: null,
		selectedHometask: null,
		page_hometask: null,
		page_note: null,
		notes_length: null,
		hometasks_length: null,
		note_update_type: null,
		hometask_update_type: null,
		note_name: null,
		note_text: null,
		note_time: null,
		note_status: null,
		hometask_name: null,
		hometask_text: null,
		hometask_time: null,
		hometask_status: null
	};
}

//----------------------------------------------- User -----------------------------------------------

// Get User
const getUser = async (user_id) => {
	try {
		const result = await userModel.findOne({user_id})
		return result
	} catch (error) {
		console.log(error)
	}
}

// Create User
const createUser = async (first_name, user_id) => {
	try {
		await userModel.create(first_name, user_id)
	} catch (error) {
		console.error('Error createUser ->');
	}
}

// Check if User exist
const checkUser = async (ctx) => {
	const first_name = ctx.update.callback_query.from.first_name
	const user_id = ctx.update.callback_query.from.id

	const user = await getUser(user_id)

	if (user) {
		user.role == 'Admin' ? ctx.session.isAdmin = false : ctx.session.isAdmin = true
		return
	}

	ctx.session.isAdmin = true
	await createUser(first_name, user_id)
}
//----------------------------------------------------------------------------------------------------


//----------------------------------------------- Note -----------------------------------------------

// New note
const newNote = async (context) => {
	const user_id = context.from.id
	const name = CryptoJS.AES.encrypt(context.session.note_name, process.env.SECRET_TOKEN).toString()
	const text = CryptoJS.AES.encrypt(context.session.note_text, process.env.SECRET_TOKEN).toString()
	const deadline_at = await timestampToMilliseconds(context.session.note_time)

	try {
		await noteModel.create(user_id, name, text, deadline_at)
		context.session.page = null
		await context.reply(context.i18n.t('new_note_alert'))
	} catch (error) {
		console.log(error)
		await context.reply(context.i18n.t('error_message'))
	}
}

// Delete note
const deleteNote = async (context) => {
	const id = context.session.selectedNote.id
	const user_id = context.from.id

	try {
		await noteModel.update({status: DELETED_STATUS}, id, user_id)
		context.session.page = null
		await context.reply(context.i18n.t('delete_note_alert'))
	} catch (error) {
		console.log(error)
		await context.reply(context.i18n.t('error_message'))
	}
}

// Update note
const updateNote = async (context) => {
	const id = context.session.selectedNote.id
	const user_id = context.from.id

	try {
		switch (context.session.note_update_type) {
			case 'name':
				const name = CryptoJS.AES.encrypt(context.message.text, process.env.SECRET_TOKEN).toString()
				await noteModel.update({name: name}, id, user_id)
				break

			case 'text':
				const text = CryptoJS.AES.encrypt(context.message.text, process.env.SECRET_TOKEN).toString()
				await noteModel.update({text: text}, id, user_id)
				break

			case 'time':
				const time = await timestampToMilliseconds(context.message.text)
				await noteModel.update({deadline_at: time}, id, user_id)
				break

			case 'status':
				await noteModel.update({status: context.session.note_status}, id, user_id)
				context.session.page = null
				break
		}
		await context.reply(context.i18n.t('note_update_alert'))
	} catch (error) {
		console.log(error)
		await context.reply(context.i18n.t('error_message'))
	}
}

// Get list of notes
const getNotes = async (context) => {
	const user_id = context.from.id

	try {
		const result = await noteModel.find(user_id, ACTIVE_STATUS)
		return result
	} catch (error) {
		console.log('Error `getNotes` -> ' + error)
	}
}

// Get list of notes name
const getNotesName = async (context) => {
	try {
		let notesArray = []
		if (context.session.notes_length)
			notesArray = Array(context.session.notes_length).fill(context.i18n.t('view'))

		return notesArray
	} catch (error) {
		console.log('Error `getNotesHame` -> ' + error)
	}
}

// Note view
const noteView = async (context) => {
	let note_view = ``
	const note_name = CryptoJS.AES.decrypt(context.session.selectedNote.name, process.env.SECRET_TOKEN).toString(CryptoJS.enc.Utf8)
	const note_text = CryptoJS.AES.decrypt(context.session.selectedNote.text, process.env.SECRET_TOKEN).toString(CryptoJS.enc.Utf8)
	const deadline_at = context.session.selectedNote.deadline_at

	if (deadline_at) {
		const date = await convertMS(deadline_at*1000, context)

		if (date) {
			note_view = `📒 *${note_name}*\n\n 📎 _${note_text}_\n\n ${context.i18n.t('time_left')}${date.day}${date.hour}${date.minute}${date.seconds}\n`
		} else {
			note_view = `📕 *${note_name}*\n\n 📎 _${note_text}_\n\n ${context.i18n.t('note_is_missing')}\n`
		}
	} else {
		note_view = `📒 *${note_name}*\n\n 📎 _${note_text}_\n`
	}

	return {text: note_view, parse_mode: 'Markdown'}
}

// Menu body notes
const menuBodyNotes = async (context) => {
	const emptyTextNotes = context.i18n.t('empty_notes_list')

	const result = await getNotes(context)
	if (!result.length) {
		context.session.notes_length = result.length
		return emptyTextNotes
	}

	const pageIndex = (context.session.page_note ?? 1) - 1
	const currentPageEntries = result.slice(pageIndex * ENTRIES_PER_PAGE_NOTE, (pageIndex + ENTRIES_PER_PAGE_NOTE) * 1)

	if (currentPageEntries[0]) {
		context.session.selectedNote = currentPageEntries[0]
	} else {
		context.session.selectedNote = result[0]
		context.session.page_note = 1
	}

	context.session.notes_length = result.length

	return await noteView(context)
}
//-----------------------------------------------------------------------------------------------------------------



//----------------------------------------------- Hometask -----------------------------------------------

// New hometask
const newHometask = async (context) => {
	const user_id = context.from.id
	const name = CryptoJS.AES.encrypt(context.session.hometask_name, process.env.SECRET_TOKEN).toString()
	const text = CryptoJS.AES.encrypt(context.session.hometask_text, process.env.SECRET_TOKEN).toString()
	const deadline_at = await timestampToMilliseconds(context.session.hometask_time)

	try {
		await hometaskModel.create(user_id, name, text, deadline_at)
		context.session.page = null
		await context.reply(context.i18n.t('new_hometask_alert'))
	} catch (error) {
		console.log(error)
		await context.reply(context.i18n.t('error_message'))
	}
}

// Delete hometask
const deleteHometask = async (context) => {
	const id = context.session.selectedHometask.id

	try {
		await hometaskModel.update({status: DELETED_STATUS}, id)
		context.session.page = null
		await context.reply(context.i18n.t('delete_hometask_alert'))
	} catch (error) {
		console.log(error)
		await context.reply(context.i18n.t('error_message'))
	}
}

// Update hometask
const updateHometask = async (context) => {
	const id = context.session.selectedHometask.id

	try {
		switch (context.session.hometask_update_type) {
			case 'name':
				const name = CryptoJS.AES.encrypt(context.message.text, process.env.SECRET_TOKEN).toString()
				await hometaskModel.update({name: name}, id)
				break

			case 'text':
				const text = CryptoJS.AES.encrypt(context.message.text, process.env.SECRET_TOKEN).toString()
				await hometaskModel.update({text: text}, id)
				break

			case 'time':
				const time = await timestampToMilliseconds(context.message.text)
				await hometaskModel.update({deadline_at: time}, id)
				break

			case 'status':
				await hometaskModel.update({status: context.session.hometask_status}, id)
				context.session.page = null
				break
		}
		await context.reply(context.i18n.t('hometask_update_alert'))
	} catch (error) {
		console.log(error)
		await context.reply(context.i18n.t('error_message'))
	}
}

// Get list of hometask
const getHometask = async (context) => {
	try {
		const result = await hometaskModel.find(ACTIVE_STATUS)
		return result
	} catch (error) {
		console.log('Error `getHometask` -> ' + error)
	}
}

// Get list of hometask name
const getHometasksName = async (context) => {
	try {
		let hometasksArray = []
		if (context.session.hometasks_length)
			hometasksArray = Array(context.session.hometasks_length).fill(context.i18n.t('view'))

		return hometasksArray
	} catch (error) {
		console.log('Error `getHometasksName` -> ' + error)
	}
}

// Hometask view
const hometaskView = async (context) => {
	let hometask_view = ``
	const hometask_name = CryptoJS.AES.decrypt(context.session.selectedHometask.name, process.env.SECRET_TOKEN).toString(CryptoJS.enc.Utf8)
	const hometask_text = CryptoJS.AES.decrypt(context.session.selectedHometask.text, process.env.SECRET_TOKEN).toString(CryptoJS.enc.Utf8)
	const deadline_at = context.session.selectedHometask.deadline_at
	const user = await getUser(context.session.selectedHometask.user_id)
	const recentlyAdded = await isRecentlyAdded(context)

	if (deadline_at) {
		const date = await convertMS(deadline_at*1000, context)

		if (date) {
			if (recentlyAdded) {
				hometask_view = `${context.i18n.t('new')}\n\n 📒 *${hometask_name}*\n\n 📎 _${hometask_text}_\n\n ${context.i18n.t('created_by')} ${user.first_name}\n ${context.i18n.t('time_left')}${date.day}${date.hour}${date.minute}${date.seconds}\n`
			} else {
				hometask_view = `📒 *${hometask_name}*\n\n 📎 _${hometask_text}_\n\n ${context.i18n.t('created_by')} ${user.first_name}\n ${context.i18n.t('time_left')}${date.day}${date.hour}${date.minute}${date.seconds}\n`
			}
		} else {
			hometask_view = `📕 *${hometask_name}*\n\n 📎 _${hometask_text}_\n\n ${context.i18n.t('created_by')} ${user.first_name}\n ${context.i18n.t('missing')}\n`
		}
	} else {
		if (recentlyAdded) {
			hometask_view = `${context.i18n.t('new')}\n\n 📒 *${hometask_name}*\n\n 📎 _${hometask_text}_\n\n ${context.i18n.t('created_by')} ${user.first_name}\n`
		} else {
			hometask_view = `📒 *${hometask_name}*\n\n 📎 _${hometask_text}_\n\n ${context.i18n.t('created_by')} ${user.first_name}\n`
		}
	}

	return {text: hometask_view, parse_mode: 'Markdown'}
}

// Menu body hometask
const menuBodyHometask = async (context) => {
	const emptyTextSubject = context.i18n.t('empty_hometask_list')

	const result = await getHometask(context)
	if (!result.length) {
		context.session.hometasks_length = result.length
		return emptyTextSubject
	}

	const pageIndex = (context.session.page_hometask ?? 1) - 1
	const currentPageEntries = result.slice(pageIndex * ENTRIES_PER_PAGE_HOMETASK, (pageIndex + ENTRIES_PER_PAGE_HOMETASK) * 1)

	if (currentPageEntries[0]) {
		context.session.selectedHometask = currentPageEntries[0]
	} else {
		context.session.selectedHometask = result[0]
		context.session.page_hometask = 1
	}

	context.session.hometasks_length = result.length

	return await hometaskView(context)
}
//-----------------------------------------------------------------------------------------------------------------



// Is recently added
const isRecentlyAdded = async (context) => {
	const date = Date.now();
	const millisecondsInHour = 3600000
	const numberOfHours = 8
	const new_hometask_status_duration = millisecondsInHour * numberOfHours
	const created_at = (context.session.selectedHometask.created_at)*1000

	const createdDifference = date - created_at
	if (createdDifference <= new_hometask_status_duration)
		return true

	return false
}

// Conver timestamp in human readable date
const convertMS = async (deadline, context) => {
	let date = Date.now();

	let milliseconds = deadline - date;

	if (milliseconds < 0) return false;

	let day, hour, minute, seconds;
	seconds = Math.floor(milliseconds / 1000);
	minute = Math.floor(seconds / 60);
	seconds = seconds % 60;
	hour = Math.floor(minute / 60);
	minute = minute % 60;
	day = Math.floor(hour / 24);
	hour = hour % 24;

	if (day >= 5) {
	  return {
		day: ` ${day} ${context.i18n.t('days')}`,
		hour: '',
		minute: '',
		seconds: ''
	  }
	}

	if (day <= 5 && day >= 1) {
	  return {
		day: ` ${day} ${context.i18n.t('days')}`,
		hour: ` ${hour} ${context.i18n.t('hours')}`,
		minute: '',
		seconds: ''
	  }
	}

	if (day <= 1 && hour >= 1) {
	  return {
		day: '',
		hour: ` ${hour} ${context.i18n.t('hours')}`,
		minute: minute == 0 ? '' : ` ${minute} ${context.i18n.t('minutes')}`,
		seconds: ''
	  }
	}

	if (hour <= 1) {
	  return {
		day: '',
		hour: '',
		minute: minute == 0 ? '' : ` ${minute} ${context.i18n.t('minutes')}`,
		seconds: seconds == 0 ? '' :  ` ${seconds} ${context.i18n.t('seconds')}`
	  }
	}
}

// Convert timestamp to milliseconds
const timestampToMilliseconds = async (timestamp) => {
	if (timestamp) {
		const time = Math.floor(new Date(`${timestamp} +0000 GMT +0200`) / 1000)
		return time
	}

	return NULL
}



//-------------------- Main menu --------------------//
const mainMenu = new MenuTemplate((ctx) => ctx.i18n.t('main_menu'))
//---------------------------------------------------//



//------------------------------------------------- Delete Note ----------------------------------------------//
const deleteNoteMenu = new MenuTemplate((ctx) => ctx.i18n.t('delete_note'))
deleteNoteMenu.interact((ctx) => ctx.i18n.t('delete_note_yes'), 'yes', {
	do: async (ctx) => {
		await deleteNote(ctx)
		await menuMiddleware.replyToContext(ctx, '/notes/')
		return false
	}
})
deleteNoteMenu.interact((ctx) => ctx.i18n.t('delete_note_no'), 'no', {
	do: async (ctx) => {
		await menuMiddleware.replyToContext(ctx, `/notes/note:${ctx.i18n.t('view')}/`)
		return false
	}
})
deleteNoteMenu.manualRow(createBackMainMenuButtons())
//-----------------------------------------------------------------------------------------------------------//



//------------------------------------------------- Update Note ----------------------------------------------//
const newNoteUpdateHandler = new StatelessQuestion('update_note', async (context) => {
	await updateNote(context)
	await menuMiddleware.replyToContext(context, `/notes/note:${context.i18n.t('view')}/`)
})

const updateNoteMenu = new MenuTemplate(menuBodyNotes)
updateNoteMenu.interact((ctx) => ctx.i18n.t('note_update_name'), 'note_name', {
	do: async (context) => {
		context.session.note_update_type = 'name'
		const noteName = context.i18n.t('note_new_name')
		await newNoteUpdateHandler.replyWithMarkdown(context, noteName)
		return false
	}
})
updateNoteMenu.interact((ctx) => ctx.i18n.t('note_update_text'), 'note_text', {
	do: async (context) => {
		context.session.note_update_type = 'text'
		const noteText = context.i18n.t('note_new_text')
		await newNoteUpdateHandler.replyWithMarkdown(context, noteText)
		return false
	}
})
updateNoteMenu.interact((ctx) => ctx.i18n.t('note_update_date'), 'note_time', {
	do: async (context) => {
		context.session.note_update_type = 'time'
		const noteTime = context.i18n.t('note_new_date')
		await newNoteUpdateHandler.replyWithMarkdown(context, noteTime)
		return false
	}
})
updateNoteMenu.manualRow(createBackMainMenuButtons())
//------------------------------------------------------------------------------------------------------------//



//------------------------------------------------- New Note -------------------------------------------------//
const newNoteNameHandler = new StatelessQuestion('new_name', async (context) => {
	context.session.note_name = context.message.text
	const noteText = context.i18n.t('note_text')
	await newNoteTextHandler.replyWithMarkdown(context, noteText)
	return false
})

const newNoteTextHandler = new StatelessQuestion('new_text', async (context) => {
	context.session.note_text = context.message.text
	const noteText = context.i18n.t('note_date')
	await newNoteTimeHandler.replyWithMarkdown(context, noteText)
	return false
})

const newNoteTimeHandler = new StatelessQuestion('new_time', async (context) => {
	context.session.note_time = context.message.text
	await newNote(context)
	await menuMiddleware.replyToContext(context, '/notes/')
})
//------------------------------------------------------------------------------------------------------------//



//------------------------------------------------ Notes -----------------------------------------------------//
const ENTRIES_PER_PAGE_NOTE = 1

const detailsNoteTemplate = new MenuTemplate(menuBodyNotes)
detailsNoteTemplate.interact((ctx) => ctx.i18n.t('note_done'), 'done', {
	do: async ctx => {
		ctx.session.note_update_type = 'status'
		ctx.session.note_status = DONE_STATUS
		await updateNote(ctx)
		await menuMiddleware.replyToContext(ctx, '/notes/')
		return false
	}
})
detailsNoteTemplate.submenu((ctx) => ctx.i18n.t('note_update'), 'update', updateNoteMenu)
detailsNoteTemplate.submenu((ctx) => ctx.i18n.t('note_delete'), 'delete', deleteNoteMenu)
detailsNoteTemplate.manualRow(createBackMainMenuButtons())

// Note menu
const notesMenu = new MenuTemplate(menuBodyNotes)
notesMenu.chooseIntoSubmenu('note', (context) => getNotesName(context), detailsNoteTemplate, {
	maxRows: 1,
	columns: ENTRIES_PER_PAGE_NOTE,
	disableChoiceExistsCheck: true,
	getCurrentPage: context => context.session.page_note,
	setPage: (context, page) => {
	  context.session.page_note = page
	}
})
notesMenu.interact((ctx) => ctx.i18n.t('new_note'), 'new_note', {
	do: async (context) => {
		const noteName = context.i18n.t('note_name')
		await newNoteNameHandler.replyWithMarkdown(context, noteName)
		return false
	}
})
notesMenu.manualRow(createBackMainMenuButtons())
// Set Notes menu as submenu in MainMenu
mainMenu.submenu((ctx) => ctx.i18n.t('private_notes'), 'notes', notesMenu)
//------------------------------------------------------------------------------------------------------------//



//------------------------------------------------- Delete Hometask ----------------------------------------------//
const deleteHometaskMenu = new MenuTemplate((ctx) => ctx.i18n.t('delete_hometask'))
deleteHometaskMenu.interact((ctx) => ctx.i18n.t('delete_hometask_yes'), 'yes', {
	do: async (ctx) => {
		await deleteHometask(ctx)
		await menuMiddleware.replyToContext(ctx, '/hometasks/')
		return false
	}
})
deleteHometaskMenu.interact((ctx) => ctx.i18n.t('delete_hometask_no'), 'no', {
	do: async (ctx) => {
		await menuMiddleware.replyToContext(ctx, `/hometasks/hometask:${ctx.i18n.t('view')}/`)
		return false
	}
})
deleteHometaskMenu.manualRow(createBackMainMenuButtons())
//-----------------------------------------------------------------------------------------------------------//



//------------------------------------------------- Update Hometask ----------------------------------------------//
const newHometaskUpdateHandler = new StatelessQuestion('update_hometask', async (context) => {
	await updateHometask(context)
	await menuMiddleware.replyToContext(context, `/hometasks/hometask:${context.i18n.t('view')}/`)
})

const updateHometaskMenu = new MenuTemplate(menuBodyHometask)
updateHometaskMenu.interact((ctx) => ctx.i18n.t('hometask_update_name'), 'hometask_name', {
	do: async (context) => {
		context.session.hometask_update_type = 'name'
		const hometaskName = context.i18n.t('hometask_new_name')
		await newHometaskUpdateHandler.replyWithMarkdown(context, hometaskName)
		return false
	}
})
updateHometaskMenu.interact((ctx) => ctx.i18n.t('hometask_update_text'), 'hometask_text', {
	do: async (context) => {
		context.session.hometask_update_type = 'text'
		const hometaskText = context.i18n.t('hometask_new_text')
		await newHometaskUpdateHandler.replyWithMarkdown(context, hometaskText)
		return false
	}
})
updateHometaskMenu.interact((ctx) => ctx.i18n.t('hometask_update_date'), 'hometask_time', {
	do: async (context) => {
		context.session.hometask_update_type = 'time'
		const hometaskTime = context.i18n.t('hometask_new_date')
		await newHometaskUpdateHandler.replyWithMarkdown(context, hometaskTime)
		return false
	}
})
updateHometaskMenu.manualRow(createBackMainMenuButtons())
//------------------------------------------------------------------------------------------------------------//



//------------------------------------------------- New Hometask -------------------------------------------------//
const newHometaskNameHandler = new StatelessQuestion('new_name_hometask', async (context) => {
	context.session.hometask_name = context.message.text
	const hometaskText = context.i18n.t('hometask_text')
	await newHometaskTextHandler.replyWithMarkdown(context, hometaskText)
	return false
})

const newHometaskTextHandler = new StatelessQuestion('new_text_hometask', async (context) => {
	context.session.hometask_text = context.message.text
	const hometaskText = context.i18n.t('hometask_date')
	await newHometaskTimeHandler.replyWithMarkdown(context, hometaskText)
	return false
})

const newHometaskTimeHandler = new StatelessQuestion('new_time_hometask', async (context) => {
	context.session.hometask_time = context.message.text
	await newHometask(context)
	await menuMiddleware.replyToContext(context, '/hometasks/')
})
//------------------------------------------------------------------------------------------------------------//



//------------------------------------------------- Hometask ----------------------------------------------//
const ENTRIES_PER_PAGE_HOMETASK = 1

const detailsHometaskTemplate = new MenuTemplate(menuBodyHometask)
detailsHometaskTemplate.interact((ctx) => ctx.i18n.t('hometask_done'), 'done', {
	hide: ctx => ctx.session.isAdmin,
	do: async ctx => {
		ctx.session.hometask_update_type = 'status'
		ctx.session.hometask_status = DONE_STATUS
		await updateHometask(ctx)
		await menuMiddleware.replyToContext(ctx, '/hometasks/')
		return false
	}
})
detailsHometaskTemplate.submenu((ctx) => ctx.i18n.t('hometask_update'), 'update', updateHometaskMenu, {
	hide: ctx => ctx.session.isAdmin
})
detailsHometaskTemplate.submenu((ctx) => ctx.i18n.t('hometask_delete'), 'delete', deleteHometaskMenu, {
	hide: ctx => ctx.session.isAdmin
})
detailsHometaskTemplate.manualRow(createBackMainMenuButtons())

// Hometask menu
const hometaskMenu = new MenuTemplate(menuBodyHometask)
hometaskMenu.chooseIntoSubmenu('hometask', (context) => getHometasksName(context), detailsHometaskTemplate, {
	maxRows: 1,
	columns: ENTRIES_PER_PAGE_HOMETASK,
	disableChoiceExistsCheck: true,
	getCurrentPage: context => context.session.page_hometask,
	setPage: (context, page) => {
	  context.session.page_hometask = page
	}
})
hometaskMenu.interact((ctx) => ctx.i18n.t('new_hometask'), 'new_hometask', {
	hide: ctx => ctx.session.isAdmin,
	do: async (context) => {
		const hometaskName = context.i18n.t('hometask_name')
		await newHometaskNameHandler.replyWithMarkdown(context, hometaskName)
		return false
	}
})
hometaskMenu.navigate((ctx) => ctx.i18n.t('update_hometask'), '/hometasks/')
hometaskMenu.manualRow(createBackMainMenuButtons())
// Set Hometask menu as submenu in MainMenu
mainMenu.submenu((ctx) => ctx.i18n.t('hometask'), 'hometasks', hometaskMenu)
//------------------------------------------------------------------------------------------------------------------//



//------------------------------------------------- Language ----------------------------------------------//
mainMenu.select('language_row_1', ['🇬🇧 English', '🇺🇦 Українська'], {
	isSet: (ctx, key) => ctx.session.choice === key,
	set: (ctx, key) => {
		ctx.session.choice = key

		switch (key) {
			case '🇬🇧 English':
				ctx.i18n.locale('en')
				break
			case '🇺🇦 Українська':
				ctx.i18n.locale('ua')
				break
		}
		return true
	}
})
mainMenu.select('language_row_2', ['🇪🇸 Spanish', '🇩🇪 Deutsch'], {
	isSet: (ctx, key) => ctx.session.choice === key,
	set: (ctx, key) => {
		ctx.session.choice = key

		switch (key) {
			case '🇪🇸 Spanish':
				ctx.i18n.locale('es')
				break
			case '🇩🇪 Deutsch':
				ctx.i18n.locale('de')
				break
		}
		return true
	}
})
//---------------------------------------------------------------------------------------------------------//



const menuMiddleware = new MenuMiddleware('/', mainMenu)
console.log(menuMiddleware.tree())

const bot = new Bot(process.env.TELEGRAM_TOKEN)
bot.use(session({ initial }))
bot.use(i18n.middleware())

bot.on('callback_query:data', async (ctx, next) => {
	console.log('callbackQuery happened', ctx.callbackQuery.data.length, ctx.callbackQuery.data)
	await checkUser(ctx)
	return next()
})

bot.use(menuMiddleware.middleware())
bot.use(newNoteUpdateHandler.middleware())
bot.use(newNoteNameHandler.middleware())
bot.use(newNoteTextHandler.middleware())
bot.use(newNoteTimeHandler.middleware())

bot.use(newHometaskUpdateHandler.middleware())
bot.use(newHometaskNameHandler.middleware())
bot.use(newHometaskTextHandler.middleware())
bot.use(newHometaskTimeHandler.middleware())
bot.catch(error => {
	console.log('bot error', error)
})

bot.command('start', async ctx => {
	menuMiddleware.replyToContext(ctx)
})

async function startup() {
	await bot.start({
		onStart: botInfo => {
			console.log(new Date(), 'Bot starts as', botInfo.username)
		},
	})
}

startup()
