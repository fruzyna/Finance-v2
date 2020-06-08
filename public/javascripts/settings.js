function deleteAccount()
{
    let password = prompt('If you are sure you want to delete your account, type your account password. All account related data will be erased.')
    window.location.replace(`/settings/delete-account?password=${password}`)
}